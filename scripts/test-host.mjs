import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(process.env.MINDFLOW_HOST_FILE || path.join(root, 'chrome/content/scripts/index.js'), 'utf8');

function fixture() {
  const items = new Map(), disk = new Map(), prefs = new Map(), elements = new Map(), listeners = new Map();
  let nextID = 10;
  function element(tag) {
    const node = { localName: tag, children: [], childNodes: [], style: {}, attrs: {}, ownerDocument: doc,
      setAttribute(k,v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      querySelector(sel) { return this.children.find(x => x.localName === 'iframe') || null; },
      querySelectorAll() { return []; }, addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {}, remove() {} };
    if (tag === 'iframe') node.contentWindow = { messages: [], postMessage(data) { this.messages.push(data); } };
    return node;
  }
  const doc = { getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [...elements.values()].flatMap(n => n.children || []).filter(n => n.localName === 'iframe'),
    createElement: tag => element(tag), addEventListener() {}, removeEventListener() {}, head: { appendChild() {} } };
  const tabs = { _tabs: [{ id: 'zotero-pane', type: 'library' }], selectedID: 'zotero-pane',
    add({type, title, data}) { const id = `tab-${nextID++}`; const container = element('tab-content');
      elements.set(id, container); this._tabs.push({ id, type, title, data }); this.selectedID = id; return { id, container }; },
    getTabContent(id) { return elements.get(id); }, select(id) { this.selectedID = id; },
    rename(id, title) { this._tabs.find(t=>t.id===id).title = title; } };
  const win = { document: doc, Zotero_Tabs: tabs, ZoteroPane: { getSelectedItems: () => [] }, focus() {},
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener() {},
    setTimeout() { return 1; }, clearTimeout() {} };
  const Zotero = { log() {}, logError() {}, getMainWindow: () => win, getActiveZoteroPane: () => win.ZoteroPane,
    Items: { get: id => items.get(id), getByLibraryAndKey: (lib,key) => [...items.values()].find(i => i.libraryID === lib && i.key === key) },
    Libraries: { userLibraryID: 1, get: id => ({ libraryID:id, groupID:id===2?55:undefined, editable:true, filesEditable:true }),
      getAll: () => [{libraryID:1},{libraryID:2}] }, Groups: { getLibraryIDFromGroupID: id => id===55?2:null },
    Prefs: { get: key => prefs.get(key), set: (k,v) => prefs.set(k,v), clear: k => prefs.delete(k) },
    DataDirectory: { dir: '/data' }, Utilities: { randomString: () => String(nextID++) },
    ProgressWindow: class { changeHeadline() {} addDescription() {} show() {} startCloseTimer() {} },
    Item: class { constructor() { this.id=nextID++; this.key=('KEY'+this.id).padEnd(8,'X'); this.fields={}; this.notes=[]; }
      setField(k,v) { this.fields[k]=v; } getField(k) { return this.fields[k] || ''; } isNote() { return true; }
      setNote(v) { this.note=v; } async saveTx() { items.set(this.id,this); items.get(this.parentItemID)?.notes.push(this.id); } },
    Attachments: { async importFromFile({file,parentItemID,libraryID,title}) {
      const att = attachment(('ATT'+nextID).padEnd(8,'X'),libraryID,parentItemID, `/storage/${nextID}.mindflow`);
      att.title=title; disk.set(att.path,disk.get(file)); items.get(parentItemID).attachments.push(att.id); return att;
    } } };
  const IOUtils = { exists: async p => disk.has(p) || [...disk.keys()].some(key=>key.startsWith(p+'/')), readUTF8: async p => { if (!disk.has(p)) throw new Error('ENOENT'); return disk.get(p); },
    writeUTF8: async (p,v,options={}) => { if (options.backupFile && disk.has(p)) disk.set(options.backupFile,disk.get(p)); disk.set(p,v); },
    makeDirectory: async () => {}, getChildren: async dir => [...disk.keys()].filter(p=>p.startsWith(dir+'/')),
    move: async (p,q) => {disk.set(q,disk.get(p));disk.delete(p);},
    remove: async p => { for (const k of disk.keys()) if (k===p||k.startsWith(p+'/')) disk.delete(k); } };
  const ctx = { Zotero, window:win, Services: { wm: { addListener() {}, removeListener() {}, getEnumerator: () => ({hasMoreElements:()=>false}) } },
    IOUtils, PathUtils: { join: (...parts)=>parts.join('/'), parent:p=>p.slice(0,p.lastIndexOf('/')), filename:p=>p.split('/').pop(), tempDir:'/tmp' },
    URL, setTimeout, clearTimeout, console };
  vm.runInNewContext(runtime.replace('  Zotero.MindFlow.init();',''), ctx);
  const host = Zotero.MindFlow;
  function paper(key, libraryID=1) {
    const item = { id:nextID++, key, libraryID, attachments:[], notes:[], title:key,
      isRegularItem:()=>true, isAttachment:()=>false, getField(k) {return k==='title'?this.title:'';},
      getAttachments() {return this.attachments;}, getNotes() {return this.notes;}, getCreators:()=>[], getTags:()=>[] };
    items.set(item.id,item); return item;
  }
  function attachment(key,libraryID,parentItemID,file) {
    const att = { id:nextID++,key,libraryID,parentItemID,path:file,attachmentFilename:'map.mindflow', title:'map.mindflow',
      isAttachment:()=>true, isRegularItem:()=>false, getField() {return this.title;}, setField(k,v) {this.title=v;},
      getFilePathAsync: async function() {return this.path;}, saveTx:async()=>{},
      eraseTx:async function() {items.delete(this.id);const p=items.get(this.parentItemID);p.attachments=p.attachments.filter(id=>id!==this.id);} };
    items.set(att.id,att); return att;
  }
  const map = (id='doc_a',title='A') => ({id,title,revision:1,root:{id:'root',text:title,children:[]},updatedAt:100,createdAt:1,themeId:'classic-blue',layoutType:'mindmap'});
  return { host, Zotero, items, disk, prefs, doc, tabs, win, listeners, IOUtils, paper, attachment, map };
}

test('tombstoned documents never appear as readable after interrupted deletion', async () => {
  const f=fixture(); f.disk.set('/data/mindflow/workspace/mindflow_doc_doc_a.json',JSON.stringify(f.map()));
  f.disk.set('/data/mindflow/workspace/mindflow_deleted_doc_doc_a.json','123');
  assert.equal(await f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'}),null);
});
test('two host snapshot updates merge instead of losing the earlier version', async () => {
  const f=fixture();const snapshot=(id,title)=>({id,docId:'doc_a',title,timestamp:1,data:JSON.stringify(f.map('doc_a',title))});
  await Promise.all(['one','two'].map(id=>f.host.workspaceStorage('mutateSnapshots',{docId:'doc_a',snapshots:[snapshot(id,id)]})));
  const saved=JSON.parse(await f.host.workspaceStorage('get',{key:'mindflow_snapshots_doc_a'}));assert.equal(saved.length,2);
  await f.host.workspaceStorage('mutateSnapshots',{docId:'doc_a',removeSnapshotId:'one'});
  assert.equal(JSON.parse(await f.host.workspaceStorage('get',{key:'mindflow_snapshots_doc_a'}))[0].id,'two');
});
test('direct workspace context accepts the owning wrapped window and records actual document ID', () => {
  const f=fixture();f.host.openMindFlow({mode:'open_document',doc:f.map()},f.win);
  const tab=f.tabs._tabs[1],frame=f.tabs.getTabContent(tab.id).children[0];
  assert.equal(f.host.updateWorkspaceContext({wrappedJSObject:frame.contentWindow},{documentId:'forked_actual',title:'Exact B',attachmentKey:'ATTACHBB',attachmentLibraryID:2}),true);
  assert.equal(tab.data.docId,'forked_actual');assert.equal(tab.data.targetItemId,'attachment:2:ATTACHBB');
  assert.equal(f.host.updateWorkspaceContext({},{documentId:'evil',title:'Wrong'}),false);assert.equal(tab.data.docId,'forked_actual');
});
test('direct handshake delivers a pending action once to the actual owning frame', () => {
  const f=fixture();f.host.openMindFlow({mode:'open_document',doc:f.map()},f.win);
  const frame=f.tabs.getTabContent(f.tabs.selectedID).children[0];frame._mindflowPending={type:'MINDFLOW_OPEN_DOCUMENT'};
  assert.equal(f.host.connectWorkspace(frame.contentWindow),true);assert.equal(frame._mindflowReady,true);
  assert.equal(frame._mindflowPending,null);assert.equal(frame.contentWindow.messages.length,1);
  f.host.connectWorkspace(frame.contentWindow);assert.equal(frame.contentWindow.messages.length,1);
});
test('host serializes concurrent compare-and-save as one mutation', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  const writes=await Promise.allSettled(['one','two'].map(title=>f.host.workspaceStorage('commitDocument',{doc:{...first,title},expectedRevision:1})));
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.filter(r=>r.status==='rejected').length,1);
});
test('delete checks revision inside the same host queue as writes', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  const update=f.host.workspaceStorage('commitDocument',{doc:{...first,title:'updated'},expectedRevision:1});
  const deletion=f.host.workspaceStorage('deleteDocument',{id:first.id,expectedRevision:1});
  await update;await assert.rejects(()=>deletion,/CONFLICT/);
  assert.equal(JSON.parse(await f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'})).title,'updated');
});
test('deletion marker hides a file when physical cleanup fails', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  f.IOUtils.remove=async()=>{throw new Error('locked');};
  await f.host.workspaceStorage('deleteDocument',{id:first.id,expectedRevision:1});
  assert.equal(await f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'}),null);
  await assert.rejects(()=>f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0}),/删除/);
});
test('explicit backup restore removes the deletion marker', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  await f.host.workspaceStorage('deleteDocument',{id:first.id,expectedRevision:1});
  const restored=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0,force:true});
  assert.equal(restored.revision,1);assert.ok(await f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'}));
});
test('one unreadable workspace record cannot block exporting other records', async () => {
  const f=fixture();f.disk.set('/data/mindflow/workspace/mindflow_doc_bad.json','{bad');
  f.disk.set('/data/mindflow/workspace/mindflow_doc_doc_a.json',JSON.stringify(f.map()));
  const records=await f.host.workspaceStorage('getAll');assert.ok(records.mindflow_doc_doc_a);assert.equal(records.mindflow_doc_bad,undefined);
});
test('closing captures latest state before the iframe is destroyed', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  const editor={_mindflowCaptureState:()=>({doc:{...first,title:'latest close'}})};
  const operation=f.host.captureWorkspaceOnClose(editor);delete editor._mindflowCaptureState;
  await operation;assert.equal(JSON.parse(await f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'})).title,'latest close');
});
test('close conflict saves a detached recovery copy rather than overwriting another editor', async () => {
  const f=fixture(),first=await f.host.workspaceStorage('commitDocument',{doc:f.map(),expectedRevision:0});
  await f.host.workspaceStorage('commitDocument',{doc:{...first,title:'other window'},expectedRevision:1});
  await f.host.captureWorkspaceOnClose({_mindflowCaptureState:()=>({doc:{...first,title:'unsaved close',metadata:{zoteroItemKey:'PAPERAAA',zoteroAttachmentKey:'ATTACHAA'}}})});
  const records=await f.host.workspaceStorage('getAll');const copy=Object.values(records).map(JSON.parse).find(d=>d.title?.includes('关闭恢复副本'));
  assert.equal(copy.metadata.autoSyncToZotero,false);assert.equal(copy.metadata.zoteroAttachmentKey,undefined);
  assert.equal(JSON.parse(records.mindflow_doc_doc_a).title,'other window');
});
test('host rejects duplicate nodes and unsafe IDs before any write', async () => {
  const f=fixture(),doc=f.map();doc.root.children=[{...doc.root}];
  await assert.rejects(()=>f.host.workspaceStorage('commitDocument',{doc,expectedRevision:0}),/重复/);
  await assert.rejects(()=>f.host.workspaceStorage('commitDocument',{doc:{...f.map(),id:'../unsafe'},expectedRevision:0}),/结构|存储键/);
  assert.equal(f.disk.size,0);
});
test('stale revision-one writer cannot recreate a deleted document', async () => {
  const f=fixture();f.disk.set('/data/mindflow/workspace/mindflow_deleted_doc_doc_a.json','123');
  await assert.rejects(()=>f.host.workspaceStorage('setMany',{items:{mindflow_doc_doc_a:JSON.stringify(f.map())}}),/删除|CONFLICT/);
});
test('archive refuses a document deleted from workspace', async () => {
  const f=fixture(),p=f.paper('PAPERAAA');f.disk.set('/data/mindflow/workspace/mindflow_deleted_doc_doc_a.json','123');
  const result=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:p.key});
  assert.equal(result.success,false);assert.equal(p.attachments.length,0);
});
test('explicit missing group item never falls through to same user-library key', () => {
  const f=fixture();f.paper('SAMEKEY1',1);assert.equal(f.host.resolveItemReference('zotero://select/groups/55/items/SAMEKEY1'),null);
});
test('bare ambiguous keys, mismatched scopes and missing groups are rejected', () => {
  const f=fixture();f.paper('SAMEKEY1',1);f.paper('SAMEKEY1',2);
  assert.equal(f.host.resolveItemReference('SAMEKEY1'),null);
  assert.equal(f.host.resolveItemReference('zotero://select/library/items/SAMEKEY1',2),null);
  assert.equal(f.host.resolveItemReference('zotero://select/groups/404/items/SAMEKEY1'),null);
});
test('eight-digit item keys stay keys; numeric API IDs remain explicit numbers', () => {
  const f=fixture();const p=f.paper('12345678');assert.equal(f.host.resolveItemReference('12345678',1),p);
  assert.equal(f.host.resolveItemReference(p.id,1),p);p.deleted=true;assert.equal(f.host.resolveItemReference('12345678',1),null);
});
test('same embedded document ID from two different papers opens separate tabs', () => {
  const f=fixture();const a=f.map(),b=f.map();a.metadata={zoteroUri:'zotero://select/library/items/PAPERAAA'};b.metadata={zoteroUri:'zotero://select/library/items/PAPERBBB'};
  f.host.openMindFlow({mode:'open_document',doc:a,openedAttachmentKey:'ATTACHAA',openedAttachmentLibraryID:1},f.win);
  f.host.openMindFlow({mode:'open_document',doc:b,openedAttachmentKey:'ATTACHBB',openedAttachmentLibraryID:1},f.win);
  assert.equal(f.tabs._tabs.length,3);
});
test('two maps under same parent never reuse each other', () => {
  const f=fixture();const a=f.map('doc_a'),b=f.map('doc_b');a.metadata=b.metadata={zoteroUri:'zotero://select/library/items/PAPERAAA'};
  for (const [doc,key] of [[a,'ATTACHAA'],[b,'ATTACHBB']]) f.host.openMindFlow({mode:'open_document',doc,openedAttachmentKey:key,openedAttachmentLibraryID:1},f.win);
  assert.equal(f.tabs._tabs.length,3);
});
test('same attachment key in different libraries never collides', () => {
  const f=fixture();for(const library of [1,2]) f.host.openMindFlow({mode:'open_document',doc:f.map(),openedAttachmentKey:'ATTACHAA',openedAttachmentLibraryID:library},f.win);
  assert.equal(f.tabs._tabs.length,3);
});
test('exact reopen uses Zotero getTabContent and preserves live edits', () => {
  const f=fixture();const options={mode:'open_document',doc:f.map(),openedAttachmentKey:'ATTACHAA',openedAttachmentLibraryID:1};
  f.host.openMindFlow(options,f.win);const id=f.tabs.selectedID;f.tabs.select('zotero-pane');f.host.openMindFlow(options,f.win);
  assert.equal(f.tabs.selectedID,id);assert.equal(f.tabs._tabs.length,2);assert.equal(f.tabs.getTabContent(id).children[0].contentWindow.messages.length,0);
});
test('same-name collections and multi-library topics have distinct identities', () => {
  const f=fixture(); const id=(o,it=[])=>f.host.openTargetIdentity(o,it);
  assert.notEqual(id({mode:'create_from_collection',collectionKey:'COLLECTA',collectionLibraryID:1}),id({mode:'create_from_collection',collectionKey:'COLLECTB',collectionLibraryID:1}));
  assert.notEqual(id({mode:'create_from_selection'},[{key:'SAMEKEY1',libraryID:1}]),id({mode:'create_from_selection'},[{key:'SAMEKEY1',libraryID:2}]));
});
test('forceNew always bypasses an existing tab', () => {
  const f=fixture();const p=f.paper('PAPERAAA');for(let i=0;i<2;i++) f.host.openMindFlow({mode:'create_from_selection',items:[p],forceNew:true},f.win);
  assert.equal(f.tabs._tabs.length,3);
});
test('toolbar reader target uses selectedID rather than stale library selection', async () => {
  const f=fixture(),a=f.paper('PAPERAAA'),b=f.paper('PAPERBBB');const pdf=f.attachment('PDFKEYAA',1,b.id,'/b.pdf');
  f.win.ZoteroPane.getSelectedItems=()=>[a];f.tabs._tabs.push({id:'reader-1',type:'reader',data:{itemID:pdf.id}});f.tabs.selectedID='reader-1';
  const calls=[];f.host.openMindFlow=(o)=>calls.push(o);await f.host.triggerMindFlowOpen(f.win);assert.equal(calls[0].items[0],b);
});
test('only the owning frame can update its tab title and binding', () => {
  const f=fixture();f.host.addToWindow(f.win);
  for(const key of ['ATTACHAA','ATTACHBB'])f.host.openMindFlow({mode:'open_document',doc:f.map(),openedAttachmentKey:key,openedAttachmentLibraryID:1},f.win);
  const [a,b]=f.tabs._tabs.slice(1), frame=f.tabs.getTabContent(b.id).children[0];
  f.listeners.get('message')({source:frame.contentWindow,origin:'null',data:{type:'MINDFLOW_SET_TAB_TITLE',title:'Only B'}});
  assert.equal(b.title,'MindFlow - Only B');assert.notEqual(a.title,b.title);
  f.listeners.get('message')({source:{},origin:'null',data:{type:'MINDFLOW_SET_PREF',key:'aiApiKey',value:'bad'}});
  assert.equal(f.prefs.size,0);
});
test('document filenames, primary payload and backup IDs must agree', async () => {
  const f=fixture();f.disk.set('/data/mindflow/workspace/mindflow_doc_doc_a.json',JSON.stringify(f.map('doc_b')));
  await assert.rejects(()=>f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'}),/身份/);
  f.disk.set('/data/mindflow/workspace/mindflow_doc_doc_a.json.bak',JSON.stringify(f.map('doc_b')));
  await assert.rejects(()=>f.host.workspaceStorage('get',{key:'mindflow_doc_doc_a'}),/身份/);
});
test('attachment enumeration excludes wrong parents, libraries and trash', () => {
  const f=fixture(),p=f.paper('PAPERAAA'),q=f.paper('PAPERBBB');const a=f.attachment('ATTACHAA',1,p.id,'/a'),b=f.attachment('ATTACHBB',1,q.id,'/b');b.deleted=true;
  p.attachments=[a.id,b.id];assert.deepEqual(Array.from(f.host.getMindflowAttachments(p)),[a]);
});
test('archive never binds an unlinked map to current selection', async () => {
  const f=fixture(),a=f.paper('PAPERAAA'),container=f.paper('CONTAIN1');f.win.ZoteroPane.getSelectedItems=()=>[a];f.host.ensureUnlinkedMapContainer=async()=>container;
  const r=await f.host.saveMindMapToItem({doc:f.map()});assert.equal(r.success,true);assert.equal(a.attachments.length,0);assert.equal(container.attachments.length,1);
});
test('archive verifies actual content and parent registration before success', async () => {
  const f=fixture(),p=f.paper('PAPERAAA');const r=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'});
  assert.equal(r.success,true);assert.ok(r.attachmentKey);assert.equal(r.attachmentLibraryID,1);
  const att=f.items.get(p.attachments[0]);assert.equal(JSON.parse(f.disk.get(att.path)).id,'doc_a');
});
test('filename token collision never overwrites another document', async () => {
  const f=fixture(),p=f.paper('PAPERAAA');const a=f.attachment('ATTACHAA',1,p.id,'/a');p.attachments.push(a.id);a.attachmentFilename='A-doc_a.mindflow';f.disk.set('/a',JSON.stringify(f.map('other')));
  const r=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'});
  assert.equal(r.success,true);assert.equal(p.attachments.length,2);assert.equal(JSON.parse(f.disk.get('/a')).id,'other');
});
test('update failure never falls back to duplicate import', async () => {
  const f=fixture(),p=f.paper('PAPERAAA'),a=f.attachment('ATTACHAA',1,p.id,'/a');p.attachments.push(a.id);f.disk.set('/a',JSON.stringify(f.map()));
  const write=f.IOUtils.writeUTF8;f.IOUtils.writeUTF8=async(path,...args)=>{if(path==='/a')throw Error('denied');return write(path,...args);};
  const r=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'});
  assert.equal(r.success,false);assert.equal(p.attachments.length,1);
});
test('read-back corruption fails and cleans only newly created attachment', async () => {
  const f=fixture(),p=f.paper('PAPERAAA');const orig=f.Zotero.Attachments.importFromFile;
  f.Zotero.Attachments.importFromFile=async options=>{const a=await orig(options);f.disk.set(a.path,'bad');return a;};
  const r=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'});
  assert.equal(r.success,false);assert.equal(p.attachments.length,0);
});
test('explicit source attachment cannot move or silently become another parent', async () => {
  const f=fixture(),p=f.paper('PAPERAAA'),q=f.paper('PAPERBBB'),a=f.attachment('ATTACHAA',1,p.id,'/a');p.attachments.push(a.id);f.disk.set('/a',JSON.stringify(f.map()));
  const doc=f.map();doc.metadata={zoteroAttachmentKey:a.key,zoteroAttachmentLibraryID:1};
  const r=await f.host.saveMindMapToItem({doc,parentItemKey:'zotero://select/library/items/PAPERBBB'});
  assert.equal(r.success,false);assert.equal(q.attachments.length,0);
});
test('concurrent same-document archives create one attachment', async () => {
  const f=fixture(),p=f.paper('PAPERAAA'),data={doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'};
  const results=await Promise.all([f.host.saveMindMapToItem(data),f.host.saveMindMapToItem(data)]);
  assert.ok(results.every(r=>r.success));assert.equal(p.attachments.length,1);
});
test('stale workspace revision cannot overwrite latest attachment', async () => {
  const f=fixture(),p=f.paper('PAPERAAA');f.disk.set('/data/mindflow/workspace/mindflow_doc_doc_a.json',JSON.stringify({...f.map(),revision:3}));
  const r=await f.host.saveMindMapToItem({doc:f.map(),parentItemKey:'zotero://select/library/items/PAPERAAA'});
  assert.equal(r.success,false);assert.equal(p.attachments.length,0);
});
test('undo-close explicitly restores a canonical detached workspace identity', async () => {
  const f=fixture();f.tabs.tabHooks={undoClose:{},restoreState:{}};
  f.Zotero.Prefs.set('extensions.mindflow.windowMode','window');
  const saved=await f.host.workspaceStorage('commitDocument',{doc:f.map('detached_restore'),expectedRevision:0});
  f.host.installTabLifecycle(f.win);
  await f.tabs.tabHooks.undoClose.mindflow({data:{docId:saved.id}},1);
  const tab=f.tabs._tabs.find(t=>t.type==='mindflow');
  assert.equal(tab.data.docId,saved.id);assert.equal(tab.data.workspaceDocumentId,saved.id);
  assert.equal(f.tabs.getTabContent(tab.id).children[0]._mindflowInitialAction.workspaceDocumentId,saved.id);
});
