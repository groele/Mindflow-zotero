import assert from 'node:assert/strict';
import { planIncomingDocument, sameDocumentSource, detachedMetadata } from '../src/services/zotero/documentIdentity';
import { resolveZoteroItem } from '../src/services/zotero/zoteroBridge';
import { StorageService, DocumentConflictError } from '../src/services/storage/storageService';
import vm from 'node:vm';
import { safeStorage } from '../src/services/storage/safeStorage';
import { BackupService } from '../src/services/storage/backupService';
import type { MindMapDocument } from '../src/core/model/types';

let count=0;
const run=async(name:string,fn:()=>unknown)=>{await fn();console.log(`PASS ${++count}: ${name}`);};
const doc=(id:string,key:string,library=1,time=100):MindMapDocument=>({id,title:key,root:{id:'root',text:key,children:[]},
  createdAt:1,updatedAt:time,revision:0,themeId:'classic-blue',layoutType:'mindmap',
  metadata:{zoteroAttachmentKey:key,zoteroAttachmentLibraryID:library,zoteroUri:'zotero://select/library/items/PAPERAAA',autoSyncToZotero:true}});
await run('newer local document from another attachment never replaces requested map',()=>assert.equal(planIncomingDocument(doc('a','SOURCE_B'),doc('a','SOURCE_A',1,999)),'fork'));
await run('same attachment key in another library is a different source',()=>assert.equal(sameDocumentSource(doc('a','SAMEKEY1',1),doc('a','SAMEKEY1',2)),false));
await run('legacy unproven source is kept separate',()=>assert.equal(planIncomingDocument(doc('a','SOURCE_A'),{...doc('a','SOURCE_A'),metadata:{}}),'fork'));
await run('latest edits of exact source are preserved',()=>assert.equal(planIncomingDocument(doc('a','SOURCE_A'),doc('a','SOURCE_A',1,999)),'local'));
await run('newer attachment can replace exact older source',()=>assert.equal(planIncomingDocument(doc('a','SOURCE_A',1,999),doc('a','SOURCE_A')),'replace'));
await run('detached imports and conflict copies clear both attachment and parent binding',()=>{
  const metadata=detachedMetadata(doc('a','SOURCE_A').metadata);
  assert.equal(metadata.autoSyncToZotero,false);assert.equal((metadata as any).zoteroUri,undefined);assert.equal((metadata as any).zoteroAttachmentKey,undefined);
});
const user={id:10,key:'SAMEKEY1',libraryID:1},group={id:11,key:'SAMEKEY1',libraryID:2};
const zotero={Libraries:{userLibraryID:1,getAll:()=>[{libraryID:1},{libraryID:2}]},Groups:{getLibraryIDFromGroupID:(id:number)=>id===55?2:null},
  Items:{get:(id:number)=>id===10?user:null,getByLibraryAndKey:(lib:number,key:string)=>key==='SAMEKEY1'?(lib===1?user:group):null}};
await run('frontend direct resolver rejects ambiguous key',()=>assert.equal(resolveZoteroItem('SAMEKEY1',zotero),null));
await run('frontend direct resolver honours group URI',()=>assert.equal(resolveZoteroItem('zotero://select/groups/55/items/SAMEKEY1',zotero),group));
await run('frontend direct resolver rejects scope conflict',()=>assert.equal(resolveZoteroItem('zotero://select/groups/55/items/SAMEKEY1',zotero,1),null));
await run('workspace key-content mismatch is a visible error',async()=>{
  safeStorage.setItem('mindflow_doc_badfile',JSON.stringify(doc('other','SOURCE_A')));
  await assert.rejects(()=>StorageService.getDocument('badfile'),/ID/);safeStorage.removeItem('mindflow_doc_badfile');
});
await run('isolated attachment is rediscovered using source even with new workspace ID',async()=>{
  await StorageService.saveDocument(doc('isolated','SOURCE_B'));
  const recovered=await StorageService.getDocumentBySource(doc('original','SOURCE_B'));
  assert.equal(recovered?.id,'isolated');
});
await run('duplicate source association cannot pick arbitrary first document',async()=>{
  await StorageService.saveDocument(doc('duplicate','SOURCE_B'));
  await assert.rejects(()=>StorageService.getDocumentBySource(doc('original','SOURCE_B')),/多份/);
});
await run('simultaneous local writes enforce revision conflict',async()=>{
  const first=await StorageService.saveDocument(doc('concurrent','SOURCE_C'));
  const results=await Promise.allSettled([
    StorageService.saveDocumentDirect({...first,title:'one'},first.revision!),
    StorageService.saveDocumentDirect({...first,title:'two'},first.revision!),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
await run('failed CAS must never advance the editor known revision',async()=>{
  const first=await StorageService.saveDocument(doc('revision_poison','SOURCE_D'));
  safeStorage.setItem('mindflow_doc_revision_poison',JSON.stringify({...first,revision:2,title:'external edit'}));
  await assert.rejects(()=>StorageService.saveDocument({...first,title:'stale first'}),/其他窗口/);
  await assert.rejects(()=>StorageService.saveDocument({...first,title:'stale retry'}),/其他窗口/);
});
await run('malformed JSON is a visible failure rather than a missing document',async()=>{
  safeStorage.setItem('mindflow_doc_corrupt','{bad');
  await assert.rejects(()=>StorageService.getDocument('corrupt'),/损坏|解析/);
  safeStorage.removeItem('mindflow_doc_corrupt');
});
await run('snapshot envelope and payload document IDs must match',async()=>{
  const current=await StorageService.saveDocument(doc('snapshot_target','SOURCE_E'));
  safeStorage.setItem('mindflow_snapshots_snapshot_target',JSON.stringify([{id:'wrong_snap',docId:'snapshot_target',title:'wrong',timestamp:1,data:JSON.stringify(doc('other_doc','SOURCE_F'))}]));
  await assert.rejects(()=>BackupService.restoreSnapshot(current.id,'wrong_snap'),/身份|ID/);
});
await run('restoring old content preserves the current verified attachment association',async()=>{
  const current=await StorageService.saveDocument(doc('restore_binding','CURRENT_A'));
  const old={...doc(current.id,'OLD_B'),title:'old content'};
  safeStorage.setItem('mindflow_snapshots_'+current.id,JSON.stringify([{id:'valid_snap',docId:current.id,title:'old',timestamp:1,data:JSON.stringify(old)}]));
  const restored=await BackupService.restoreSnapshot(current.id,'valid_snap');
  assert.equal(restored?.title,'old content');assert.equal(restored?.metadata?.zoteroAttachmentKey,'CURRENT_A');
});
await run('storage validates duplicate descendant IDs, not only root shape',async()=>{
  const bad=doc('bad_nodes','SOURCE_G');bad.root.children=[{...bad.root}];
  await assert.rejects(()=>StorageService.saveDocument(bad),/重复/);
  assert.equal(safeStorage.getItem('mindflow_doc_bad_nodes'),null);
});
await run('deleted fallback records remain hidden from rebuilt list',async()=>{
  const first=await StorageService.saveDocument(doc('deleted_list','SOURCE_H'));
  await StorageService.deleteDocument(first.id);
  safeStorage.setItem('mindflow_doc_'+first.id,JSON.stringify(first));
  safeStorage.removeItem('mindflow_docs_index');
  assert.equal((await StorageService.getDocumentList()).some(d=>d.id===first.id),false);
  assert.equal(await StorageService.getDocument(first.id),null);
});
await run('explicit restore can recreate a deleted local document',async()=>{
  const restored=await StorageService.saveDocument(doc('deleted_list','SOURCE_H'),{force:true});
  assert.equal((await StorageService.getDocument(restored.id))?.id,restored.id);
});
await run('cross-compartment host errors retain typed revision-conflict behavior',async()=>{
  const previous=(globalThis as any).window;
  const foreignError=vm.runInNewContext('new Error("MINDFLOW_REVISION_CONFLICT: native conflict")');
  assert.equal(foreignError instanceof Error,false);
  (globalThis as any).window={location:{protocol:'chrome:',host:'mindflow'},Zotero:{MindFlow:{workspaceStorage:async()=>{throw foreignError;}}}};
  try {await assert.rejects(()=>StorageService.saveDocumentDirect(doc('cross_realm','SOURCE_I'),0),DocumentConflictError);}
  finally {if(previous===undefined) delete (globalThis as any).window;else (globalThis as any).window=previous;}
});
await run('simultaneous recovery snapshots retain both versions',async()=>{
  const base=doc('snapshot_concurrent','SOURCE_J');
  await Promise.all([BackupService.createSnapshot({...base,title:'version one'}),BackupService.createSnapshot({...base,title:'version two'})]);
  const snapshots=await BackupService.getSnapshots(base.id);
  assert.equal(snapshots.length,2);assert.equal(new Set(snapshots.map(s=>s.title)).size,2);
});
await run('workspace restore keeps detached identity and reads canonical newer content',async()=>{
  const saved=await StorageService.saveDocument({...doc('restore_detached','unused'),metadata:{autoSyncToZotero:false}});
  const newer=await StorageService.saveDocument({...saved,title:'canonical latest'});
  const restored=await StorageService.resolveWorkspaceOpen(saved.id,saved);
  assert.equal(restored.id,saved.id);assert.equal(restored.title,'canonical latest');assert.equal(restored.revision,newer.revision);
  assert.equal(restored.metadata?.zoteroAttachmentKey,undefined);
});
await run('workspace restore rejects mismatched and deleted targets without importing',async()=>{
  const saved=await StorageService.saveDocument({...doc('restore_removed','unused'),metadata:{autoSyncToZotero:false}});
  await assert.rejects(()=>StorageService.resolveWorkspaceOpen('other_identity',saved),/ID 不一致/);
  await StorageService.deleteDocument(saved.id);
  await assert.rejects(()=>StorageService.resolveWorkspaceOpen(saved.id,saved),/不存在或已删除/);
  assert.equal(await StorageService.getDocument(saved.id),null);
});
await run('restore-deleted permission never bypasses the revision check for an existing document', async () => {
  const saved = await StorageService.saveDocument(doc('restore_cas', 'safe'));
  await assert.rejects(() => StorageService.saveDocumentDirect({ ...saved, title: 'stale backup' }, 0, 'restore-deleted'), DocumentConflictError);
  assert.equal((await StorageService.getDocument(saved.id))?.title, 'safe');
});
await run('backup preflight cannot overwrite a document created before commit', async () => {
  const incoming = doc('restore_race', 'backup');
  const original = StorageService.saveDocumentDirect;
  let injected = false;
  StorageService.saveDocumentDirect = async function(value, expected, force) {
    if (value.id === incoming.id && !injected) {
      injected = true;
      await original.call(this, { ...incoming, title: 'new concurrent document' }, 0);
    }
    return original.call(this, value, expected, force);
  };
  try {
    await assert.rejects(() => BackupService.importFullWorkspaceData({ documents: [incoming] } as any), /恢复中断/);
    assert.equal((await StorageService.getDocument(incoming.id))?.title, 'new concurrent document');
  } finally { StorageService.saveDocumentDirect = original; }
});
await run('backup restore deliberately revives a deleted document without unconditional overwrite', async () => {
  const saved = await StorageService.saveDocument(doc('restore_tombstone', 'backup'));
  await StorageService.deleteDocument(saved.id);
  await BackupService.importFullWorkspaceData({ documents: [saved] } as any);
  assert.equal((await StorageService.getDocument(saved.id))?.title, saved.title);
});
await run('corrupt snapshot records fail before rendering or mutation', async () => {
  const base = doc('corrupt_snapshots', 'test');
  safeStorage.setItem('mindflow_snapshots_' + base.id, '[null]');
  await assert.rejects(() => BackupService.getSnapshots(base.id), /身份|属性/);
  await assert.rejects(() => BackupService.createSnapshot(base), /身份|属性/);
  assert.equal(safeStorage.getItem('mindflow_snapshots_' + base.id), '[null]');
});
await run('duplicate backup snapshot IDs are rejected before any document write', async () => {
  const base = doc('duplicate_snapshots', 'test');
  const snap = { id: 'same', docId: base.id, title: 'snapshot', timestamp: 1, data: JSON.stringify(base) };
  await assert.rejects(() => BackupService.importFullWorkspaceData({ documents: [base], snapshots: [snap, snap] } as any), /重复/);
  assert.equal(await StorageService.getDocument(base.id), null);
});
await run('corrupt local snapshot target aborts backup before document creation', async () => {
  const base = doc('import_bad_history', 'test');
  safeStorage.setItem('mindflow_snapshots_' + base.id, '[null]');
  await assert.rejects(() => BackupService.importFullWorkspaceData({ documents: [base] } as any), /身份|属性/);
  assert.equal(await StorageService.getDocument(base.id), null);
});
await run('backup snapshot import applies the configured retention limit', async () => {
  const base = doc('import_history_limit', 'test');
  const snapshots = Array.from({ length: 60 }, (_, i) => ({ id: 'limit_' + i, docId: base.id,
    title: 'history', timestamp: i, data: JSON.stringify(base) }));
  await BackupService.importFullWorkspaceData({ documents: [base], snapshots } as any);
  const saved = await BackupService.getSnapshots(base.id);
  assert.equal(saved.length, 20); assert.equal(saved[0].timestamp, 59);
});
await run('secondary restore failure explicitly reports the documents already saved', async () => {
  const base = doc('import_partial_report', 'test');
  safeStorage.setItem('mindflow_inbox_items', '[null]');
  try {
    await assert.rejects(() => BackupService.importFullWorkspaceData({ documents: [base], inboxItems: [] } as any), /已保存 1\/1.*收集箱/);
    assert.equal((await StorageService.getDocument(base.id))?.title, base.title);
  } finally { safeStorage.removeItem('mindflow_inbox_items'); }
});
await run('first default document returns the exact committed revision and timestamp', async () => {
  safeStorage.clear();
  const active = await StorageService.getActiveDocument();
  const stored = await StorageService.getDocument(active.id);
  assert.equal(active.revision, 1);
  assert.deepEqual(active, stored);
});
console.log(`${count} frontend data-chain tests passed`);
