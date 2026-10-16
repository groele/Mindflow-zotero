import assert from 'node:assert/strict';
import { planIncomingDocument, sameDocumentSource, detachedMetadata } from '../src/services/zotero/documentIdentity';
import { resolveZoteroItem } from '../src/services/zotero/zoteroBridge';
import { StorageService, DocumentConflictError } from '../src/services/storage/storageService';
import vm from 'node:vm';
import { safeStorage } from '../src/services/storage/safeStorage';
import { BackupService } from '../src/services/storage/backupService';
import type { MindMapDocument } from '../src/core/model/types';
import { prepareResearchAnalysis, requestResearchAnalysis, createResearchDocument } from '../src/services/zotero/researchAnalysis';
import { computeLayout } from '../src/core/layout/layoutEngine';
import { getTheme, THEMES } from '../src/core/theme/themes';

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
await run('deletion tombstone hides a document even while its index and file remain',async()=>{
  const first=await StorageService.saveDocument(doc('tombstone_fast_path','SOURCE_T'));
  safeStorage.setItem('mindflow_deleted_doc_'+first.id,'123');
  try {
    assert.equal((await StorageService.getDocumentList()).some(item=>item.id===first.id),false);
    assert.equal(await StorageService.getDocument(first.id),null);
  } finally {
    safeStorage.removeItem('mindflow_deleted_doc_'+first.id);
    await StorageService.deleteDocument(first.id);
  }
});
await run('corrupt local document remains visible in the rebuilt workspace list',async()=>{
  safeStorage.setItem('mindflow_doc_corrupt_list','{broken');
  safeStorage.removeItem('mindflow_docs_index');
  try {
    const row=(await StorageService.getDocumentList()).find(item=>item.id==='corrupt_list');
    assert.equal(row?.title,'数据损坏（corrupt_list）');
    await assert.rejects(()=>StorageService.getDocument('corrupt_list'),/损坏|ID/);
  } finally {
    safeStorage.removeItem('mindflow_doc_corrupt_list');
    safeStorage.removeItem('mindflow_docs_index');
  }
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
await run('AI chrome iframe uses injected host API and forwards model, reasoning, cancellation and progress', async () => {
  const previous = (globalThis as any).window;
  const controller = new AbortController(), calls: any[] = [], progress: any[] = [];
  const preview = { preparedId: 'prepared' };
  const analysis = { title: 'Article', zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { model: 'gpt-5.4', reasoningLevel: 'high' }, sections: { findings: [] } };
  (globalThis as any).window = { parent: { postMessage: () => { throw new Error('Must prefer native host API'); } },
    Zotero: { MindFlow: {
      preparePaperAnalysis: async (ref: string, opts: any) => { calls.push({ ref, opts }); return preview; },
      analyzePaperWithAI: async (ref: string, opts: any) => { calls.push({ ref, opts }); opts.onProgress('分析', 1, 2); return analysis; },
    } } };
  try {
    const selection = { preparedId: 'previous', text: 'Confirmed local abstract' };
    assert.equal(await prepareResearchAnalysis('article-ref', controller.signal, 'abstract', selection), preview);
    assert.equal(calls[0].opts.readingMode, 'abstract');
    assert.deepEqual(calls[0].opts.abstractSelection, selection);
    assert.equal(await requestResearchAnalysis('article-ref', { preparedId: 'prepared', modelEntryId: 'model-two',
      reasoningLevel: 'high', templateId: 'experimental-evidence', signal: controller.signal, onProgress: value => progress.push(value) }), analysis);
    assert.equal(calls[1].opts.modelEntryId, 'model-two');
    assert.equal(calls[1].opts.reasoningLevel, 'high');
    assert.equal(calls[1].opts.templateId, 'experimental-evidence');
    assert.equal(calls[1].opts.signal, controller.signal);
    assert.deepEqual(progress, [{ phase: '分析', completed: 1, total: 2 }]);
    controller.abort();
    await assert.rejects(() => prepareResearchAnalysis('article-ref', controller.signal), /取消/);
    assert.equal(calls.length, 2);
  } finally { (globalThis as any).window = previous; }
});
await run('structured upstream summary becomes an editable local draft retaining requested model and reasoning', () => {
  const result = createResearchDocument({ title: 'Article', zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { templateId: 'experimental', model: 'gpt-5.4', reasoningLevel: 'high', hasAbstract: true, noteCount: 0, annotationCount: 0 },
    sections: { findings: [{ text: 'Measured result', detail: 'Conditions', basis: 'paper', source: 'abstract',
      sourceId: 'AB', quote: 'Measured result', verification: 'matched' }] } } as any, { themeId: 'classic-blue', layoutType: 'mindmap' });
  assert.equal(result.metadata?.aiDraft, true);
  assert.equal(result.metadata?.autoSyncToZotero, false);
  assert.equal(result.metadata?.aiEvidenceCount, 1);
  assert.ok(result.root.children.some(branch => branch.children.some(node => node.text.includes('Measured result'))));
  assert.match(result.root.note || '', /llm-for-zotero.*gpt-5.4.*high/);
});
await run('all fixed templates preserve content structure and selected appearance', () => {
  const configs: Array<[string, number]> = [['experimental', 12], ['experimental-compact', 8],
    ['experimental-evidence', 10], ['experimental-protocol', 9],
    ['theoretical', 12], ['mechanism', 12], ['review', 12]];
  const claims = Array.from({ length: 5 }, (_, index) => ({ text: 'Finding ' + index, basis: 'inference' }));
  for (const [templateId, size] of configs) {
    const document = createResearchDocument({ title: 'Article', zoteroUri: 'zotero://select/library/items/PAPERAAA',
      sourceScope: { templateId, readingMode: 'abstract' }, sections: { findings: claims, predictions: claims } } as any, { themeId: 'classic-blue', layoutType: 'mindmap' });
    assert.equal(document.root.children.length, size);
    assert.equal(document.layoutType, 'mindmap');
    assert.equal(document.themeId, 'classic-blue');
    assert.equal(document.metadata?.aiTemplateId, templateId);
    assert.match(document.root.note || '', /仅摘要/);
    if (templateId === 'experimental-compact') assert.equal(document.root.children.find(node => node.text.includes('主要发现'))?.children.length, 2);
    if (templateId === 'theoretical') assert.ok(document.root.children.some(node => node.text.includes('理论预测')));
  }
});
await run('evidence counts and badges cover only visible claims with verified paper sources', () => {
  const claim = { text: 'Visible measured result', basis: 'paper', source: 'abstract', quote: 'measured result', verification: 'matched' };
  const document = createResearchDocument({ title: 'Article', zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { templateId: 'experimental-compact' }, sections: {
      findings: [{ ...claim, text: '' }, claim, { ...claim, text: 'Unmatched result', verification: 'unmatched' }, claim],
      predictions: [claim], mechanism: [{ ...claim, text: 'Reader idea', source: 'note' }],
    } } as any, { themeId: 'classic-blue', layoutType: 'mindmap' });
  assert.equal(document.metadata?.aiEvidenceCount, 1);
  assert.equal(document.metadata?.aiReviewCount, 2);
  const findings = document.root.children.find(branch => branch.text.includes('主要发现'))!;
  assert.equal(findings.children.length, 2);
  assert.deepEqual(findings.children[1].icons, ['question']);
  assert.match(findings.children[1].note || '', /推断／待核验/);
  const mechanism = document.root.children.find(branch => branch.text.includes('作用机理'))!;
  assert.deepEqual(mechanism.children[0].icons, ['question']);
  assert.ok(!document.root.note?.includes('解决的问题：资料不足'));
  assert.ok(!document.root.note?.includes('理论预测'));
});
await run('concise nodes preserve full model wording, numeric conditions, evidence and manual-source warning', () => {
  const text = '长材料名称与解释'.repeat(30) + '；温度 300 K、激发波长 532 nm、准确率 >95%（动态视觉）';
  const result = createResearchDocument({ title: 'Article', zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { abstractSource: 'manual', templateId: 'experimental-compact' }, sections: { findings: [{
      text, detail: '作者解释，未独立验证', basis: 'inference', source: 'abstract', verification: 'matched', quote: 'accuracy >95%' }] } } as any, { themeId: 'classic-blue', layoutType: 'mindmap' });
  const node = result.root.children.find(branch => branch.text === '主要发现')!.children[0];
  assert.equal(node.text, text);
  assert.deepEqual(node.icons, ['question']);
  assert.match(node.note || '', /作者解释.*\n|作者解释/);
  assert.match(node.note || '', /accuracy >95%/);
  assert.match(result.root.note || '', /用户粘贴.*未与本地 PDF 核对/);
});
await run('default story groups observations and author explanations by discovery without fabricating missing sections', () => {
  const fact = (text: string, topic = '光谱演化', subtopic = '实验观测') => ({
    text, topic, subtopic, detail: '适用条件与对照', basis: 'paper', source: 'pdf',
    sourceId: 'P1', quote: 'measured at 2 K', verification: 'matched',
  });
  const text = '激子光谱：在 2 K 和 7 T 条件下低能支的强度增加，需与未接触区对照，数值与不确定性完整保留。';
  const document = createResearchDocument({ title: '长篇文章标题'.repeat(10), zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { readingMode: 'full' }, sections: {
      question: [fact('核心问题：低能支增强来自何种弛豫通道？')],
      findings: [fact(text), fact('温度效应：80 K 时谱重下降。', '温度依赖', '温度响应')],
      mechanism: [{ ...fact('作者解释：层间耦合改变弛豫通道。', '光谱演化', '作者解释'), basis: 'inference' }],
    } } as any, { themeId: 'paper-reading', layoutType: 'mindmap' });
  assert.equal(document.themeId, 'paper-reading');
  assert.equal(document.layoutType, 'mindmap');
  assert.equal(document.root.children.length, 2);
  const discoveries = document.root.children.find(branch => branch.text === '关键发现与机制')!.children;
  assert.equal(discoveries.length, 2);
  const leaf = discoveries[0].children[0];
  assert.equal(leaf.text, text);
  assert.match(discoveries[0].children[1].text, /^待核验：作者解释/);
  assert.equal(document.metadata?.aiEvidenceCount, 3);
  assert.equal(document.metadata?.aiReviewCount, 1);
  const defaultLayout = computeLayout(document.root, document.layoutType, getTheme(document.themeId));
  const rootLayout = defaultLayout.nodes.find(node => node.id === document.root.id)!;
  const mainBranches = defaultLayout.nodes.filter(node => document.root.children.some(child => child.id === node.id));
  assert.ok(mainBranches.some(node => node.x + node.width <= rootLayout.x), 'Reading map needs a left branch');
  assert.ok(mainBranches.some(node => node.x >= rootLayout.x + rootLayout.width), 'Reading map needs a right branch');
  for (const layoutType of ['logic-right', 'mindmap', 'org-down'] as const) {
    const layout = computeLayout(document.root, layoutType, getTheme(document.themeId), { rainbowBranches: true });
    const longNode = layout.nodes.find(node => node.id === leaf.id)!;
    assert.equal(longNode.textLines?.join(''), text);
    assert.ok(longNode.textLines!.length > 1 && longNode.height >= longNode.textLines!.length * 20 + 14);
    for (let index = 0; index < layout.nodes.length; index++) {
      const a = layout.nodes[index];
      for (const b of layout.nodes.slice(index + 1)) assert.ok(
        a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
        `Overlapping reading nodes: ${a.node.text} and ${b.node.text}`);
    }
    assert.ok(layout.connections.every(connection => connection.color === '#549688' && connection.strokeWidth === 1));
  }
});
await run('AI hierarchy and evidence are independent of every available theme and layout', () => {
  const claim = { text: '在 2 K 和 7 T 下观测到发光强度增加；'.repeat(5), topic: '光谱演化', subtopic: '实验观测',
    detail: '对照与不确定性', basis: 'paper', source: 'abstract', quote: 'measured at 2 K', verification: 'matched' };
  const analysis = { title: '长篇文章标题'.repeat(12), zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { templateId: 'paper-story' }, sections: { findings: [claim], mechanism: [{ ...claim, basis: 'inference' }] } } as any;
  const contentTree = (node: MindMapDocument['root']): any => ({ text: node.text, note: node.note, icons: node.icons,
    link: node.link, children: node.children.map(contentTree) });
  const reference = contentTree(createResearchDocument(analysis, { themeId: 'paper-reading', layoutType: 'mindmap' }).root);
  for (const themeId of Object.keys(THEMES)) for (const layoutType of ['mindmap', 'logic-right', 'org-down'] as const) {
    const document = createResearchDocument(analysis, { themeId, layoutType });
    assert.equal(document.themeId, themeId);
    assert.equal(document.layoutType, layoutType);
    assert.deepEqual(contentTree(document.root), reference);
    const theme = getTheme(themeId);
    const layout = computeLayout(document.root, layoutType, theme, { rainbowBranches: true });
    assert.equal(layout.nodes[0].bgColor, theme.rootBg);
    const leaf = layout.nodes.find(node => node.node.text === claim.text)!;
    assert.equal(leaf.textLines?.join(''), claim.text);
    assert.equal(leaf.readingStyle, themeId === 'paper-reading');
    for (let index = 0; index < layout.nodes.length; index++) {
      const a = layout.nodes[index];
      for (const b of layout.nodes.slice(index + 1)) assert.ok(
        a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
        `Overlapping nodes in ${themeId}/${layoutType}`);
    }
  }
});
await run('condensed story caps branches and preserves omitted facts and quotes in notes', () => {
  const findings = Array.from({ length: 12 }, (_, index) => ({ text: `独立观测 ${index}：变化幅度 ${index + 1}%`,
    topic: `主题 ${Math.floor(index / 2)}`, basis: 'paper', source: 'pdf', quote: `quote for result ${index}`, verification: 'matched' }));
  const document = createResearchDocument({ title: 'Core question paper', zoteroUri: 'zotero://select/library/items/PAPERAAA',
    sourceScope: { templateId: 'paper-story' }, sections: { findings, question: [findings[0]], significance: [findings[1]] } } as any,
    { themeId: 'macaron', layoutType: 'mindmap' });
  assert.ok(document.root.children.length <= 5);
  assert.ok(document.root.children.find(branch => branch.text === '关键发现与机制')!.children.length <= 3);
  const nodes: MindMapDocument['root'][] = [];
  const walk = (node: MindMapDocument['root']) => { nodes.push(node); node.children.forEach(walk); };
  walk(document.root);
  const leaves = nodes.filter(node => !node.children.length && node.icons?.length);
  assert.equal(new Set(leaves.map(node => node.text)).size, leaves.length);
  assert.equal(document.metadata?.aiEvidenceCount, leaves.filter(node => node.icons?.includes('check')).length);
  assert.ok(document.metadata?.aiSupplementaryCount > 0);
  for (const claim of findings) {
    assert.ok(nodes.some(node => node.text === claim.text) || document.root.note?.includes(claim.text));
    assert.ok(nodes.some(node => node.note?.includes(claim.quote)));
  }
});
console.log(`${count} frontend data-chain tests passed`);
