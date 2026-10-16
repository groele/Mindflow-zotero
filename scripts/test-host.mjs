import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(process.env.MINDFLOW_HOST_FILE || path.join(root, 'chrome/content/scripts/index.js'), 'utf8');

test('item-pane sidenav localization is tooltip-only so the narrow rail stays icon-only', () => {
  const zh = fs.readFileSync(path.join(root, 'locale/zh-CN/mindflow.ftl'), 'utf8');
  const en = fs.readFileSync(path.join(root, 'locale/en-US/mindflow.ftl'), 'utf8');
  assert.match(runtime, /sidenav:\s*\{\s*l10nID:\s*'mindflow-item-pane-sidenav'/);
  for (const locale of [zh, en]) {
    const block = locale.match(/mindflow-item-pane-sidenav\s*=([\s\S]*?)(?=\n\S|$)/)?.[1] || '';
    assert.match(block, /\.tooltiptext\s*=/);
    assert.doesNotMatch(block, /\.label\s*=/);
  }
});

test('host inbox concurrent additions preserve both durable records', async () => {
  const f = fixture(), item = id => ({ id, text: id, createdAt: 1, isProcessed: false });
  await Promise.all(['one', 'two'].map(id => f.host.workspaceStorage('mutateInbox', { additions: [item(id)] })));
  const items = JSON.parse(await f.host.workspaceStorage('get', { key: 'mindflow_inbox_items' }));
  assert.equal(items.length, 2); assert.ok(f.disk.has('/data/mindflow/workspace/mindflow_inbox_items.json'));
});
test('host inbox migrates legacy preferences and serializes restore plus processing', async () => {
  const f = fixture(), item = id => ({ id, text: id, createdAt: 1, isProcessed: false });
  f.prefs.set('mindflow.mindflow_inbox_items', JSON.stringify([item('legacy')]));
  await Promise.all([f.host.workspaceStorage('mutateInbox', { processedId: 'legacy', isProcessed: true }),
    f.host.workspaceStorage('mutateInbox', { additions: [item('restored')] })]);
  const items = JSON.parse(await f.host.workspaceStorage('get', { key: 'mindflow_inbox_items' }));
  assert.equal(items.length, 2); assert.equal(items.find(item => item.id === 'legacy').isProcessed, true);
  await f.host.workspaceStorage('mutateInbox', { clearProcessed: true });
  assert.equal(JSON.parse(await f.host.workspaceStorage('get', { key: 'mindflow_inbox_items' }))[0].id, 'restored');
});
test('invalid inbox additions cannot overwrite a valid inbox', async () => {
  const f = fixture();
  await f.host.workspaceStorage('mutateInbox', { additions: [{ id: 'valid', text: 'v', createdAt: 1, isProcessed: false }] });
  await assert.rejects(() => f.host.workspaceStorage('mutateInbox', { additions: [{ id: 'bad', text: 1 }] }), /无效/);
  assert.equal(JSON.parse(await f.host.workspaceStorage('get', { key: 'mindflow_inbox_items' })).length, 1);
});
test('inbox write verification failure is reported rather than a successful operation', async () => {
  const f = fixture(); const write = f.IOUtils.writeUTF8;
  f.IOUtils.writeUTF8 = async (...args) => { await write(...args); f.disk.set(args[0], '[]'); };
  await assert.rejects(() => f.host.workspaceStorage('mutateInbox', { additions: [{ id: 'v', text: 'v', createdAt: 1, isProcessed: false }] }), /校验失败/);
});
function hangingTurn(_request, _onEvent, { signal }) {
  return new Promise((_resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
test('upstream call timeout remains effective when a caller supplies cancellation signal', async () => {
  const f = llmFixture(hangingTurn), controller = new AbortController();
  let watchdog;
  try {
    await assert.rejects(() => Promise.race([
      f.host._testLLMRequest({ config: f.host.getAIConfiguration(), payload: {}, timeout: 20, signal: controller.signal }),
      new Promise((_resolve, reject) => { watchdog = setTimeout(() => reject(new Error('timeout guard never fired')), 250); }),
    ]), /超时/);
  } finally { clearTimeout(watchdog); controller.abort(); }
});
test('explicit upstream cancellation is not mislabeled as a timeout', async () => {
  const f = llmFixture(hangingTurn), controller = new AbortController();
  const request = f.host._testLLMRequest({ config: f.host.getAIConfiguration(), payload: {}, timeout: 1000, signal: controller.signal });
  controller.abort();
  await assert.rejects(() => request, /已取消/);
});

function fixture(options = {}) {
  const items = new Map(), disk = new Map(), prefs = new Map(), elements = new Map(), listeners = new Map();
  let nextID = 10;
  function element(tag) {
    const node = { localName: tag, children: [], childNodes: [], style: {}, attrs: {}, ownerDocument: doc, isConnected: true,
      replaceChildren(...children) { this.children = []; for (const c of children) this.appendChild(c); },
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
    fetch: options.fetch, AbortController,
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener() {},
    setTimeout() { return 1; }, clearTimeout() {} };
  const Zotero = { log() {}, logError() {}, getMainWindow: () => win, getActiveZoteroPane: () => win.ZoteroPane,
    File: { getContentsFromURL: async () => fs.readFileSync(path.join(root, 'chrome/content/research-templates.json'), 'utf8') },
    Items: { get: id => items.get(id), getByLibraryAndKey: (lib,key) => [...items.values()].find(i => i.libraryID === lib && i.key === key) },
    Libraries: { userLibraryID: 1, get: id => ({ libraryID:id, groupID:id===2?55:undefined, editable:true, filesEditable:true }),
      getAll: () => [{libraryID:1},{libraryID:2}] }, Groups: { getLibraryIDFromGroupID: id => id===55?2:null },
    Prefs: { get: key => prefs.get(key), set: (k,v) => prefs.set(k,v), clear: k => prefs.delete(k) },
    DataDirectory: { dir: '/data' }, Utilities: { randomString: () => String(nextID++) },
    ProgressWindow: class { changeHeadline() {} addDescription() {} show() {} startCloseTimer() {} },
    Notifier: { observers: new Map(),
      registerObserver(observer, types, id) { this.observers.set(id, observer); return id; },
      unregisterObserver(id) { this.observers.delete(id); },
      trigger(event, type, ids) { for (const obs of this.observers.values()) obs.notify?.(event, type, ids); } },
    ItemPaneManager: { sections: new Map(),
      registerSection(section) { const id = 'sec_' + nextID++; this.sections.set(id, section); return id; },
      unregisterSection(id) { this.sections.delete(id); } },
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
  vm.runInNewContext(runtime.replace('  Zotero.MindFlow.init();','  Zotero.MindFlow._testLLMRequest = callLLMForZotero;'), ctx);
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

const llmPref = 'extensions.zotero.llmforzotero.';
const llmGroups = () => [{ id: 'provider-one', apiBase: 'https://upstream.invalid/v1',
  apiKey: 'upstream-secret', authMode: 'api_key', providerProtocol: 'openai_chat_compat',
  models: [{ id: 'model-one', model: 'gpt-5.4' }, { id: 'model-two', model: 'deepseek-reasoner' }] }];
function llmFixture(runTurn = async () => ({ kind: 'completed', text: '{"sections":{"findings":[]}}' })) {
  const f = fixture({ fetch: () => { throw new Error('MindFlow must not issue HTTP'); } });
  f.prefs.set(llmPref + 'modelProviderGroups', JSON.stringify(llmGroups()));
  f.prefs.set(llmPref + 'lastUsedModelEntryId', 'model-one');
  f.Zotero.LLMForZotero = { data: { alive: true, initialized: true },
    api: { agent: { runTurn, getCapabilities: () => ({ reasoning: true }) } } };
  f.host.serializeZoteroItem = (item) => ({ title: item.title,
    zoteroUri: `zotero://select/library/items/${item.key}`, abstract: 'The experiment shows enhanced emission.',
    notes: [{ text: 'private excluded note', uri: 'zotero://note' }], annotations: [] });
  return f;
}

test('missing or old upstream plugin produces an actionable error without own HTTP fallback', () => {
  const f = fixture();
  assert.throws(() => f.host.getAIConfiguration(), /安装并启用 llm-for-zotero/);
  f.Zotero.LLMForZotero = { data: { initialized: true }, api: {} };
  assert.throws(() => f.host.getAIConfiguration(), /3.9.11/);
});

test('analysis uses the selected upstream model and reasoning and excludes deselected materials', async () => {
  const calls = [], f = llmFixture(async (request, _onEvent, options) => {
    calls.push(request); assert.ok(options.signal);
    return { kind: 'completed', runId: 'verified-run-' + calls.length, text: JSON.stringify({ sections: { findings: [{ text: '发光增强',
      detail: '', basis: 'paper', source: 'abstract', sourceId: 'AB', quote: 'enhanced emission' }] } }) };
  });
  const paper = f.paper('AIARTIC1'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  assert.equal(preview.models.length, 2);
  assert.equal(preview.defaultModelEntryId, 'model-one');
  assert.ok(!JSON.stringify(preview).includes('upstream-secret'));
  assert.ok(!JSON.stringify([...f.host._aiPrepared.values()]).includes('upstream-secret'));
  const opts = { preparedId: preview.preparedId, mode: 'quick', modelEntryId: 'model-two', reasoningLevel: 'high',
    sources: { abstract: true, pdf: false, notes: false, highlights: false, comments: false } };
  const result = await f.host.analyzePaperWithAI(ref, opts);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'deepseek-reasoner');
  assert.equal(calls[0].apiKey, 'upstream-secret');
  assert.equal(calls[0].providerProtocol, 'openai_chat_compat');
  assert.equal(calls[0].reasoning.provider, 'deepseek');
  assert.equal(calls[0].reasoning.level, 'high');
  assert.equal(calls[0].item, null);
  assert.equal(calls[0].activeItemId, undefined);
  assert.equal(calls[0].history.length, 0);
  assert.ok(!calls[0].userText.includes('private excluded note'));
  assert.equal(result.sections.findings[0].verification, 'matched');
  assert.equal(result.sourceScope.model, 'deepseek-reasoner');
  assert.equal(result.sourceScope.reasoningLevel, 'high');
  assert.equal(result.sourceScope.llmIntegration.api, 'agent.runTurn');
  assert.equal(result.sourceScope.llmIntegration.completedCalls, 1);
  assert.equal(result.sourceScope.llmIntegration.runIds[0], 'verified-run-1');
  assert.equal(f.disk.size, 0, 'analysis must not archive automatically');
  await f.host.analyzePaperWithAI(ref, opts);
  assert.equal(calls.length, 1, 'same scope should reuse its result');
  await f.host.analyzePaperWithAI(ref, { ...opts, reasoningLevel: 'low' });
  await f.host.analyzePaperWithAI(ref, { ...opts, modelEntryId: 'model-one' });
  assert.equal(calls.length, 3, 'model and reasoning changes must not reuse another result');
  assert.equal(new Set(calls.map(call => call.conversationKey)).size, 3);
  assert.ok(!JSON.stringify(result).includes('upstream-secret'));
});

test('upstream extra tool requests are stopped before they can read other sources', async () => {
  let executed = false, signal;
  const f = llmFixture(async (_request, onEvent, options) => {
    signal = options.signal;
    await onEvent({ type: 'tool_call', name: 'paper_read' });
    executed = true;
    return { kind: 'completed', text: '{}' };
  });
  await assert.rejects(() => f.host._testLLMRequest({ config: f.host.getAIConfiguration(), payload: {} }), /额外工具/);
  assert.equal(executed, false); assert.equal(signal.aborted, true);
});

test('upstream incomplete or malformed responses never become a successful analysis', async () => {
  const f = llmFixture(async () => ({ kind: 'fallback', reason: 'unavailable' }));
  await assert.rejects(() => f.host._testLLMRequest({ config: f.host.getAIConfiguration(), payload: {} }), /未完成|调用失败/);
  f.Zotero.LLMForZotero.api.agent.runTurn = async () => { throw new Error('Authorization: Bearer upstream-secret'); };
  await assert.rejects(() => f.host._testLLMRequest({ config: f.host.getAIConfiguration(), payload: {} }),
    error => /调用失败/.test(error.message) && !error.message.includes('upstream-secret'));
  f.Zotero.LLMForZotero.api.agent.runTurn = async () => ({ kind: 'completed', text: 'not JSON' });
  const item = f.paper('BADJSON1'), ref = `zotero://select/library/items/${item.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId }), /JSON 结构/);
});

test('configuration changes and removed model selections invalidate a prepared analysis', async () => {
  const f = llmFixture(), item = f.paper('CHANGED1'), ref = `zotero://select/library/items/${item.key}`;
  const preview = await f.host.preparePaperAnalysis(ref), groups = llmGroups();
  groups[0].apiBase = 'https://different.invalid/v1';
  f.prefs.set(llmPref + 'modelProviderGroups', JSON.stringify(groups));
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId }), /配置已变化/);
  assert.throws(() => f.host.getAIConfiguration('nonexistent'), /已移除/);
});

test('unsupported backend is visible while other upstream models remain selectable', () => {
  const f = llmFixture(), groups = llmGroups();
  groups.push({ id: 'web', authMode: 'webchat', models: [{ id: 'web-one', model: 'chatgpt' }] });
  f.prefs.set(llmPref + 'modelProviderGroups', JSON.stringify(groups));
  const models = f.host.getAIModels();
  assert.equal(models.length, 3);
  assert.equal(models[2].available, false);
  assert.match(models[2].message, /暂支持 API/);
  assert.equal(models[0].available, true);
});

test('upstream custom reasoning options are selectable, validated and forwarded without exposing request configuration', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: { findings: [{ text: 'Result', source: 'abstract', quote: 'enhanced emission' }] } }) };
  });
  const groups = llmGroups();
  groups[0].models[0].profileOverride = { forModel: 'gpt-5.4', extraBody: { private_extension: 'private-profile-data' },
    reasoning: { kind: 'select', options: [
      { id: 'off', label: '关闭推理', controls: { body: { thinking: { type: 'disabled' } } } },
      { id: 'ultra', label: '深度研究', controls: { body: { reasoning_effort: 'high' } } },
      { id: 'disabled', enabled: false }, { id: 'INVALID' }] } };
  groups[0].models[1].profileOverride = { reasoning: { kind: 'none', options: [] } };
  f.prefs.set(llmPref + 'modelProviderGroups', JSON.stringify(groups));
  const paper = f.paper('CUSTOM01'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  assert.deepEqual(Array.from(preview.models[0].reasoningOptions, option => option.id), ['default', 'off', 'ultra']);
  assert.equal(preview.models[1].reasoningSupported, false);
  assert.ok(!JSON.stringify(preview).includes('private-profile-data'));
  assert.equal(preview.models[0].apiBase, undefined);
  assert.equal(preview.models[0].advanced, undefined);
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, reasoningLevel: 'high' }), /选项无效/);
  await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, reasoningLevel: 'ultra' });
  assert.equal(calls[0].reasoning.level, 'ultra');
  assert.equal(calls[0].advanced.profileOverride.reasoning.options[1].controls.body.reasoning_effort, 'high');
  assert.equal(calls.length, 1);
});

test('deep segmented summaries preserve material, conditions and mechanism branches through the same upstream API', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    const payload = JSON.parse(request.userText);
    const sourceId = payload.pdfSegments?.[0]?.id || payload.pdf?.[0]?.id || 'P1';
    return { kind: 'completed', runId: 'deep-run-' + calls.length, text: JSON.stringify({ sections: {
      system: [{ text: 'MoSe2', source: 'pdf', sourceId, quote: 'MoSe2 at 4 K' }],
      conditions: [{ text: '4 K', source: 'pdf', sourceId, quote: 'at 4 K shows' }],
      mechanism: [{ text: 'Charge transfer', source: 'pdf', sourceId, quote: 'charge transfer' }],
      findings: [{ text: 'Enhanced emission', source: 'pdf', sourceId, quote: 'enhanced emission' }],
    } }) };
  });
  const paper = f.paper('DEEP0001'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  const prepared = f.host._aiPrepared.get(preview.preparedId);
  prepared.pdfText = 'MoSe2 at 4 K shows enhanced emission through charge transfer. '.repeat(600);
  prepared.pdfState = 'Synthetic PDF regression';
  prepared.readingMode = 'full';
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'deep', templateId: 'experimental' });
  assert.equal(calls.length, 3);
  assert.equal(result.sourceScope.llmIntegration.completedCalls, 3);
  for (const key of ['system', 'conditions', 'mechanism', 'findings']) {
    assert.equal(result.sections[key].length, 1);
    assert.equal(result.sections[key][0].verification, 'matched');
  }
});

test('abort listeners are released on successful preparation and invalid model responses', async () => {
  const f = llmFixture(), paper = f.paper('CANCEL01'), ref = `zotero://select/library/items/${paper.key}`;
  const listeners = new Set(), signal = { aborted: false,
    addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn) };
  const preview = await f.host.preparePaperAnalysis(ref, { signal });
  assert.equal(listeners.size, 0);
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, signal }), /没有提取/);
  assert.equal(listeners.size, 0);
  signal.aborted = true;
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { signal }), /取消/);
});

test('reading scopes send only selected article sections and abstract mode never extracts PDF', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: { question: [{ text: 'Research question', basis: 'inference' }] } }) };
  });
  const paper = f.paper('PART0001'), ref = `zotero://select/library/items/${paper.key}`;
  const pdf = f.attachment('PDFPART1', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  let extractions = 0;
  const intro = 'INTRODUCTION_SELECTED material motivation knowledge gap. '.repeat(8);
  const conclusion = 'CONCLUSION_SELECTED main conclusion and future outlook. '.repeat(4);
  f.Zotero.PDFWorker = { getFullText: async () => { extractions++;
    return { text: `Article title\n1. Introduction\n${intro}\n2. Results\nUNSELECTED_RESULTS_TOKEN\n3. Methods\nUNSELECTED_METHODS_TOKEN\n4. Conclusions\n${conclusion}\nReferences\nUNSELECTED_REFERENCES_TOKEN`, totalPages: 8, extractedPages: 8 }; } };
  for (const readingMode of ['abstract', 'introduction', 'conclusion', 'key-sections', 'full']) {
    const preview = await f.host.preparePaperAnalysis(ref, { readingMode });
    const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick',
      sources: { abstract: true, pdf: true, notes: false, highlights: false, comments: false } });
    const body = calls.at(-1).userText;
    assert.equal(result.sourceScope.readingMode, readingMode);
    assert.equal(body.includes('INTRODUCTION_SELECTED'), ['introduction', 'key-sections', 'full'].includes(readingMode));
    assert.equal(body.includes('CONCLUSION_SELECTED'), ['conclusion', 'key-sections', 'full'].includes(readingMode));
    assert.equal(body.includes('enhanced emission'), ['abstract', 'key-sections', 'full'].includes(readingMode));
    assert.equal(body.includes('UNSELECTED_RESULTS_TOKEN'), readingMode === 'full');
    if (readingMode === 'abstract') { assert.equal(extractions, 0); assert.equal(preview.sourceScope.pdfCharacters, 0); }
  }
  assert.equal(extractions, 4);
});

test('section switching reuses unchanged PDF text and invalidates it after file changes', async () => {
  const f = llmFixture(), paper = f.paper('CACHE001'), ref = `zotero://select/library/items/${paper.key}`;
  const pdf = f.attachment('CACHEPDF', 1, paper.id, '/cached.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/cached.pdf', 'PDF');
  let modified = 1, reads = 0;
  f.IOUtils.stat = async () => ({ size: 100, lastModified: modified });
  f.Zotero.PDFWorker = { getFullText: async () => { reads++; return { text:
    `Introduction\n${'Selected introduction motivation. '.repeat(10)}\nResults\nPRIVATE_RESULT\nConcluding remarks\nA concise conclusion answers the central question.\nReferences\nPRIVATE_REFERENCE`, extractedPages: 8, totalPages: 8 }; } };
  const intro = await f.host.preparePaperAnalysis(ref, { readingMode: 'introduction' });
  const conclusion = await f.host.preparePaperAnalysis(ref, { readingMode: 'conclusion' });
  assert.equal(reads, 1);
  assert.deepEqual(Array.from(intro.sourceScope.sectionStatus.found), ['introduction']);
  assert.deepEqual(Array.from(conclusion.sourceScope.sectionStatus.found), ['conclusion']);
  assert.ok(!f.host._aiPrepared.get(conclusion.preparedId).pdfText.includes('PRIVATE_RESULT'));
  modified++;
  await f.host.preparePaperAnalysis(ref, { readingMode: 'conclusion' });
  assert.equal(reads, 2);
});

test('long selected sections use one analysis call without quick sampling or full-paper leakage', async () => {
  const calls = [], f = llmFixture(async request => { calls.push(request); return { kind: 'completed',
    text: JSON.stringify({ sections: { question: [{ text: 'Selected research question', basis: 'inference' }] } }) }; });
  const paper = f.paper('LONGPART'), ref = `zotero://select/library/items/${paper.key}`;
  const pdf = f.attachment('LONGPDF1', 1, paper.id, '/long.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/long.pdf', 'PDF');
  f.Zotero.PDFWorker = { getFullText: async () => `Introduction\n${'Selected motivation and literature gap. '.repeat(800)}\nSELECTED_TAIL\nResults\nPRIVATE_RESULT` };
  const preview = await f.host.preparePaperAnalysis(ref, { readingMode: 'introduction' });
  assert.equal(preview.deepCalls, 1);
  await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick' });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].userText.includes('SELECTED_TAIL'));
  assert.ok(!calls[0].userText.includes('PRIVATE_RESULT'));
  assert.ok(calls[0].systemPrompt.includes('聚焦研究背景'));
});

test('missing or ambiguous section headings never cause a silent full-paper fallback', async () => {
  let calls = 0;
  const f = llmFixture(async () => { calls++; return { kind: 'completed', text: '{}' }; });
  const paper = f.paper('PART0002'), ref = `zotero://select/library/items/${paper.key}`;
  const pdf = f.attachment('PDFPART2', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  f.Zotero.PDFWorker = { getFullText: async () => 'Unstructured full paper that must not be sent. '.repeat(20) };
  let preview = await f.host.preparePaperAnalysis(ref, { readingMode: 'conclusion' });
  assert.equal(preview.sourceScope.pdfCharacters, 0);
  assert.equal(preview.sourceScope.sectionStatus.missing[0], 'conclusion');
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId,
    sources: { notes: false, highlights: false, comments: false } }), /未选择/);
  assert.equal(calls, 0);
  f.Zotero.PDFWorker.getFullText = async () => ('Conclusions\nPossible conclusion text. '.repeat(10) + '\nReferences\n').repeat(2);
  preview = await f.host.preparePaperAnalysis(ref, { readingMode: 'conclusion' });
  assert.equal(preview.sourceScope.pdfCharacters, 0);
  assert.equal(preview.sourceScope.sectionStatus.missing.length, 1);
});

test('missing metadata abstract is recovered from PDF front pages without sending the body or widening the reading scope', async () => {
  const calls = [], f = llmFixture(async request => { calls.push(request); return { kind: 'completed',
    text: JSON.stringify({ sections: { findings: [{ text: 'Result', basis: 'paper', source: 'abstract', sourceId: 'AB', quote: 'The experiment shows enhanced emission.' }] } }) }; });
  const paper = f.paper('ABSPDF01'), ref = `zotero://select/library/items/${paper.key}`;
  f.host.serializeZoteroItem = () => ({ title: 'PDF only', zoteroUri: ref, abstract: '  ', notes: [], annotations: [] });
  const pdf = f.attachment('ABSPDF02', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  const requestedPages = [];
  const paragraph = 'The experiment shows enhanced emission. The abstract describes the material and principal findings only. '.repeat(3);
  f.Zotero.PDFWorker = { getFullText: async (_id, pages) => { requestedPages.push(pages);
    return { text: `Article title\nAbstract: ${paragraph}\nKeywords: physics\n1. Introduction\nPRIVATE_BODY_TOKEN ${'Body text. '.repeat(40)}\n2. Results\nPRIVATE_RESULT_TOKEN`, totalPages: 20, extractedPages: pages }; } };
  const preview = await f.host.preparePaperAnalysis(ref);
  assert.equal(preview.readingMode, 'abstract');
  assert.equal(preview.sourceScope.paperHasAbstract, false);
  assert.equal(preview.sourceScope.pdfAttachmentCount, 1);
  assert.equal(preview.sourceScope.hasAbstract, true);
  assert.equal(preview.sourceScope.abstractSource, 'pdf');
  assert.equal(preview.sourceScope.pdfCharacters, 0);
  assert.equal(preview.sourceScope.pdfTruncated, false);
  assert.deepEqual(requestedPages, [5]);
  assert.equal(calls.length, 0, 'preparation must not send article');
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId });
  assert.equal(result.sourceScope.abstractSource, 'pdf');
  assert.equal(result.sections.findings[0].verification, 'matched');
  assert.ok(!calls[0].userText.includes('PRIVATE_BODY_TOKEN'));
  assert.ok(!calls[0].userText.includes('PRIVATE_RESULT_TOKEN'));
  f.Zotero.PDFWorker.getFullText = async () => `Article title Abstract ${paragraph} Keywords: physics 1. Introduction PRIVATE_BODY_TOKEN`;
  const flattened = await f.host.preparePaperAnalysis(ref);
  assert.equal(flattened.sourceScope.abstractSource, 'pdf');
  await f.host.analyzePaperWithAI(ref, { preparedId: flattened.preparedId });
  assert.ok(!calls.at(-1).userText.includes('PRIVATE_BODY_TOKEN'));
});

test('unrecognized or duplicate PDF abstracts leave an actionable empty preview and never substitute the body', async () => {
  const f = llmFixture(), paper = f.paper('ABSFAIL1'), ref = `zotero://select/library/items/${paper.key}`;
  f.host.serializeZoteroItem = () => ({ title: 'Missing abstract', zoteroUri: ref, abstract: '', notes: [], annotations: [] });
  const pdf = f.attachment('ABSFAIL2', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  const paragraph = 'A sufficiently long abstract paragraph describing research results and conditions. '.repeat(4);
  for (const text of ['Introduction\nBODY_ONLY '.repeat(20), `Abstract\n${paragraph}\nIntroduction\nBody\nAbstract\n${paragraph}\nReferences`]) {
    f.Zotero.PDFWorker = { getFullText: async () => text };
    const preview = await f.host.preparePaperAnalysis(ref);
    assert.equal(preview.sourceScope.abstractSource, 'none');
    assert.equal(preview.sourceScope.hasAbstract, false);
    assert.equal(preview.sourceCharacters.abstract, 0);
    assert.equal(preview.sourceScope.pdfCharacters, 0);
    assert.equal(preview.sourceScope.pdfAttachmentCount, 1);
    assert.deepEqual(Array.from(preview.sourceScope.sectionStatus.missing), ['abstract']);
    await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId }), /未选择/);
  }
});

test('confirmed PDF abstract selection enables abstract-only input without leaking local recovery text', async () => {
  const calls = [], f = llmFixture(async request => { calls.push(request); return { kind: 'completed',
    text: JSON.stringify({ sections: { findings: [{ text: '发光增强', basis: 'paper', source: 'abstract', sourceId: 'AB', quote: 'enhanced emission' }] } }) }; });
  const paper = f.paper('MANUALAB'), ref = `zotero://select/library/items/${paper.key}`;
  f.host.serializeZoteroItem = () => ({ title: 'Unlabelled abstract', zoteroUri: ref, abstract: '', notes: [],
    annotations: [{ text: 'PRIVATE_HIGHLIGHT', comment: 'PRIVATE_COMMENT' }] });
  const pdf = f.attachment('MANUALPD', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  const paragraph = 'The experiment shows enhanced emission in this material under controlled conditions.';
  let reads = 0;
  f.Zotero.PDFWorker = { getFullText: async () => { reads++; return { text: `Authors\n${paragraph}\nPRIVATE_BODY_TOKEN`, extractedPages: 5, totalPages: 19 }; } };
  const empty = await f.host.preparePaperAnalysis(ref);
  assert.equal(empty.sourceScope.hasAbstract, false);
  assert.equal(empty.sourceScope.pdfTruncated, false);
  assert.equal(empty.sourceScope.highlightCount, 1);
  assert.equal(empty.sourceScope.commentCount, 1);
  assert.ok(empty.abstractExcerpt.includes('PRIVATE_BODY_TOKEN'));
  const preview = await f.host.preparePaperAnalysis(ref, { readingMode: 'abstract', abstractSelection: { preparedId: empty.preparedId, text: paragraph } });
  assert.notEqual(preview.preparedId, empty.preparedId);
  assert.equal(reads, 1, 'confirmation should reuse the local snapshot');
  assert.equal(preview.sourceScope.abstractSource, 'pdf-selected');
  assert.equal(preview.sourceCharacters.abstract, paragraph.length);
  assert.equal(preview.sourceScope.pdfCharacters, 0);
  assert.equal(preview.sourceScope.sectionStatus.missing.length, 0);
  assert.equal(calls.length, 0);
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId });
  assert.equal(result.sections.findings[0].basis, 'paper');
  const reconfirmed = await f.host.preparePaperAnalysis(ref, { abstractSelection: { preparedId: preview.preparedId, text: paragraph } });
  assert.equal(reconfirmed.sourceScope.abstractSource, 'pdf-selected', 'reviewing the same confirmed abstract must retain its original source');
  assert.ok(calls[0].userText.includes(paragraph));
  for (const token of ['PRIVATE_BODY_TOKEN', 'PRIVATE_HIGHLIGHT', 'PRIVATE_COMMENT', 'abstractExcerpt']) assert.ok(!calls[0].userText.includes(token));
});

test('pasted abstracts remain unverified and selection snapshots cannot cross papers or expire', async () => {
  const f = llmFixture(async () => ({ kind: 'completed', text: JSON.stringify({ sections: { findings: [{
    text: '待核对摘要中的发光增强', basis: 'paper', source: 'abstract', sourceId: 'AB', quote: 'enhanced emission' }] } }) }));
  const paper = f.paper('PASTEDAB'), other = f.paper('OTHERABS'), ref = `zotero://select/library/items/${paper.key}`;
  f.host.serializeZoteroItem = item => ({ title: 'No PDF', zoteroUri: `zotero://select/library/items/${item.key}`, abstract: '', notes: [], annotations: [] });
  const empty = await f.host.preparePaperAnalysis(ref);
  const selection = { preparedId: empty.preparedId, text: 'The experiment shows enhanced emission in this material under controlled conditions.' };
  await assert.rejects(() => f.host.preparePaperAnalysis(`zotero://select/library/items/${other.key}`, { abstractSelection: selection }), /文献已改变/);
  await assert.rejects(() => f.host.preparePaperAnalysis(ref, { readingMode: 'full', abstractSelection: selection }), /已过期/);
  await assert.rejects(() => f.host.preparePaperAnalysis(ref, { abstractSelection: { ...selection, text: 'short' } }), /50/);
  const preview = await f.host.preparePaperAnalysis(ref, { abstractSelection: selection });
  assert.equal(preview.sourceScope.abstractSource, 'manual');
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId });
  assert.equal(result.sections.findings[0].verification, 'matched');
  assert.equal(result.sections.findings[0].basis, 'inference');
  f.host._aiPrepared.get(empty.preparedId).createdAt -= 16 * 60 * 1000;
  await assert.rejects(() => f.host.preparePaperAnalysis(ref, { abstractSelection: selection }), /已过期/);
});

test('section boundaries handle summary, theory and tight numbering without treating measurements as headings', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: { question: [{ text: 'Question', basis: 'inference' }] } }) };
  });
  const paper = f.paper('BOUND001'), ref = `zotero://select/library/items/${paper.key}`;
  const pdf = f.attachment('BOUND002', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
  paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
  const intro = 'Introduction selected motivation and knowledge gap. '.repeat(8);
  const conclusion = 'Conclusion selected major findings and limitations. '.repeat(5);
  for (const boundary of ['Summary and outlook', 'Conclusions and perspectives', 'Theory', '2.Methods']) {
    f.Zotero.PDFWorker = { getFullText: async () => `1.Introduction\n${intro}\n20 K MEASUREMENT_RETAINED\n${boundary}\nUNSELECTED_LATER_SECTION ${conclusion}\nReferences\nUNSELECTED_REFERENCES` };
    const preview = await f.host.preparePaperAnalysis(ref, { readingMode: 'introduction' });
    await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick' });
    assert.ok(calls.at(-1).userText.includes('MEASUREMENT_RETAINED'));
    assert.ok(!calls.at(-1).userText.includes('UNSELECTED_LATER_SECTION'));
    if (boundary.startsWith('Summary') || boundary.startsWith('Conclusions')) {
      const summary = await f.host.preparePaperAnalysis(ref, { readingMode: 'conclusion' });
      assert.equal(summary.sourceScope.sectionStatus.found[0], 'conclusion');
      await f.host.analyzePaperWithAI(ref, { preparedId: summary.preparedId, mode: 'quick' });
      assert.ok(!calls.at(-1).userText.includes('UNSELECTED_REFERENCES'));
    }
  }
  f.Zotero.PDFWorker.getFullText = async () => `Introduction\n${intro}\nUnrecognized remaining manuscript without a reliable boundary. `.repeat(3);
  const missing = await f.host.preparePaperAnalysis(ref, { readingMode: 'introduction' });
  assert.equal(missing.sourceScope.pdfCharacters, 0);
});

test('story synthesis retains more than five candidates, discovery groups and original quotes', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    const payload = JSON.parse(request.userText);
    const segment = payload.pdfSegment;
    const findings = segment ? Array.from({ length: 7 }, (_, index) => ({
      text: `Observation ${segment.id}-${index}`, topic: '光谱响应', subtopic: '定量观测',
      detail: 'The comparison and measurement conditions stay visible.', basis: 'paper',
      source: 'pdf', sourceId: segment.id, quote: `evidence number ${index} measured at 2 K`,
    })) : payload.segmentDrafts.findings.slice(0, 12).map(entry => ({
      candidateId: entry.candidateId, topicId: 'T1', subtopic: '定量观测',
      text: 'MALICIOUS_REWRITE', quote: 'A fabricated synthesis quote must be ignored', sourceId: 'P999',
    }));
    return { kind: 'completed', text: JSON.stringify({ topics: [{ id: 'T1', label: '光谱响应' }], sections: {
      findings, system: segment ? [{ text: `Sample ${segment.id}`, detail: 'Do not erase sample identity',
        source: 'pdf', sourceId: segment.id, basis: 'paper', quote: 'evidence number 1 measured at 2 K' }] : [],
    } }) };
  });
  const paper = f.paper('STORY001'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  const prepared = f.host._aiPrepared.get(preview.preparedId);
  prepared.pdfText = (Array.from({ length: 7 }, (_, index) => `evidence number ${index} measured at 2 K. `).join('') + 'x '.repeat(80)).repeat(80);
  prepared.readingMode = 'full';
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'deep' });
  assert.ok(calls.length >= 3);
  assert.ok(calls[0].systemPrompt.includes('30～100字'));
  assert.ok(calls[0].systemPrompt.includes('最多 8 项'));
  const candidates = JSON.parse(calls.at(-1).userText).segmentDrafts.findings;
  assert.ok(candidates.length > 5);
  assert.ok(candidates.some(entry => entry.sourceId === 'P2'));
  assert.equal(result.sourceScope.templateId, 'paper-story');
  assert.equal(result.sourceScope.synthesisCandidateLimit, 24);
  assert.equal(result.sections.findings.length, 12);
  assert.ok(result.sections.findings.every(entry => entry.topic === '光谱响应' && entry.subtopic === '定量观测' && entry.verification === 'matched'));
  assert.ok(result.sections.findings.every(entry => entry.text.startsWith('Observation P') && entry.quote.startsWith('evidence number')));
  assert.equal(result.sections.system.length, 2, 'Synthesis must not erase extracted sample identity');
  assert.ok(result.sections.system.every(entry => entry.verification === 'matched'));
});

test('plain-string model columns are retained as unverified text instead of silently disappearing', async () => {
  const f = llmFixture(async () => ({ kind: 'completed', text: JSON.stringify({ sections: {
    system: ['MoSe2/FePS3 on SiO2/Si'], conditions: ['Measured at 4 K'],
    findings: [{ text: 'Result', basis: 'inference' }],
  } }) }));
  const paper = f.paper('STRINGS1'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick' });
  assert.equal(result.sections.system[0].text, 'MoSe2/FePS3 on SiO2/Si');
  assert.equal(result.sections.conditions[0].basis, 'inference');
  assert.equal(result.sections.system[0].source, 'none');
  assert.equal(result.sections.system[0].quote, '');
});

test('story rejects unknown topic IDs and too many main discoveries without manufacturing a map', async () => {
  for (const badTopics of [false, true]) {
    const f = llmFixture(async () => ({ kind: 'completed', text: JSON.stringify({
      topics: badTopics ? Array.from({ length: 6 }, (_, index) => ({ id: `T${index}`, label: `Group ${index}` }))
        : [{ id: 'T1', label: 'Observation' }],
      sections: { findings: [{ text: 'Measured result', basis: 'inference', topicId: 'MISSING' }] },
    }) }));
    const paper = f.paper('TOPICS01'), ref = `zotero://select/library/items/${paper.key}`;
    const preview = await f.host.preparePaperAnalysis(ref);
    await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick' }),
      badTopics ? /过多关键发现/ : /主题关联/);
  }
});

test('host defaults extra materials to opt-in and refuses a stale reading scope before calling upstream', async () => {
  const calls = [], f = llmFixture(async request => { calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: { findings: [{ text: 'Result', basis: 'inference' }] } }) }; });
  const paper = f.paper('OPTIN001'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, readingMode: 'full' }), /读取范围已变化/);
  assert.equal(calls.length, 0);
  const opts = { preparedId: preview.preparedId };
  const first = await f.host.analyzePaperWithAI(ref, opts);
  assert.ok(!calls[0].userText.includes('private excluded note'));
  first.sections.findings[0].text = 'MUTATED_BY_CALLER';
  const second = await f.host.analyzePaperWithAI(ref, opts);
  assert.equal(second.sections.findings[0].text, 'Result');
  assert.equal(calls.length, 1);
  await f.host.analyzePaperWithAI(ref, { ...opts, sources: { notes: true } });
  assert.ok(calls.at(-1).userText.includes('private excluded note'));
  assert.equal(calls.length, 2);
});

if (process.env.MINDFLOW_REAL_SCOPE_INPUT && process.env.MINDFLOW_REAL_SCOPE_TEXT) {
  test('real article extracted text retains narrow scopes through the current host without a remote model call', async () => {
    const input = JSON.parse(fs.readFileSync(process.env.MINDFLOW_REAL_SCOPE_INPUT, 'utf8'));
    const text = fs.readFileSync(process.env.MINDFLOW_REAL_SCOPE_TEXT, 'utf8'), scopes = {};
    const calls = [], f = llmFixture(async request => { calls.push(request);
      return { kind: 'completed', text: JSON.stringify({ sections: { question: [{ text: 'Question', basis: 'inference' }] } }) }; });
    const paper = f.paper('REAL0001'), ref = `zotero://select/library/items/${paper.key}`;
    f.host.serializeZoteroItem = () => ({ title: input.title, zoteroUri: ref, abstract: input.abstract, notes: [], annotations: [] });
    const pdf = f.attachment('REAL0002', 1, paper.id, '/paper.pdf'); pdf.isPDFAttachment = () => true;
    paper.attachments.push(pdf.id); f.disk.set('/paper.pdf', 'PDF');
    let extractions = 0;
    f.Zotero.PDFWorker = { getFullText: async () => { extractions++; return { text, extractedPages: 8, totalPages: 8 }; } };
    for (const readingMode of ['abstract', 'introduction', 'conclusion', 'key-sections', 'full']) {
      const preview = await f.host.preparePaperAnalysis(ref, { readingMode });
      scopes[readingMode] = { characters: preview.sourceCharacters.abstract + preview.sourceCharacters.pdf,
        found: Array.from(preview.sourceScope.sectionStatus.found), missing: Array.from(preview.sourceScope.sectionStatus.missing) };
      if (readingMode !== 'full') {
        await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, mode: 'quick' });
        assert.ok(!calls.at(-1).userText.includes('2. Results and Discussion'));
        assert.ok(!calls.at(-1).userText.includes('4. Experimental Section'));
      }
      if (readingMode === 'abstract') assert.equal(extractions, 0);
    }
    assert.deepEqual(scopes['key-sections'].found, ['introduction', 'conclusion']);
    assert.equal(scopes['key-sections'].missing.length, 0);
    assert.ok(scopes['key-sections'].characters < scopes.full.characters / 4);
    if (process.env.MINDFLOW_REAL_SCOPE_REPORT) fs.writeFileSync(process.env.MINDFLOW_REAL_SCOPE_REPORT,
      JSON.stringify({ test: 'current-host-real-extracted-text', remoteModelCalls: 0, scopes }, null, 2));
  });
}

test('fixed template choice changes the upstream schema, branch keys and cache scope', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: { question: [{ text: 'Question', basis: 'inference' }],
      assumptions: [{ text: 'Model assumption', basis: 'inference' }] } }) };
  });
  const paper = f.paper('TMPL0001'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  await assert.rejects(() => f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, templateId: 'unknown' }), /模板无效/);
  for (const templateId of ['experimental', 'experimental-compact', 'experimental-evidence', 'experimental-protocol', 'theoretical', 'mechanism', 'review']) {
    const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, templateId });
    assert.equal(result.sourceScope.templateId, templateId);
    assert.equal(Boolean(result.sections.assumptions), templateId === 'theoretical');
    assert.ok(calls.at(-1).systemPrompt.includes('各分支要求'));
    if (templateId === 'experimental-compact') assert.ok(calls.at(-1).systemPrompt.includes('每个分支最多 2 项'));
  }
  assert.equal(calls.length, 7);
});

test('custom research prompts reach upstream, remain in provenance and partition cached results', async () => {
  const calls = [], f = llmFixture(async request => {
    calls.push(request);
    return { kind: 'completed', text: JSON.stringify({ sections: {
      question: [{ text: 'What controls emission?', basis: 'inference' }],
    } }) };
  });
  const paper = f.paper('PRESET01'), ref = `zotero://select/library/items/${paper.key}`;
  const preview = await f.host.preparePaperAnalysis(ref);
  for (const prompt of ['', 'Focus on controls.', 'Focus on temperature.', 'Focus on controls.']) {
    const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, customPrompt: prompt });
    assert.equal(result.sourceScope.customPrompt, prompt);
  }
  assert.equal(calls.length, 3);
  assert.ok(JSON.stringify(calls[1]).includes('Focus on controls.'));
  assert.ok(calls[1].systemPrompt.includes('不能覆盖上述证据与输出规则'));
  assert.ok(!JSON.stringify(preview).includes('upstream-secret'));
});

test('oversize and nontext research prompts fail before model calls', async () => {
  let calls = 0;
  const f = llmFixture(async () => { calls++; return { kind: 'completed', text: '{}' }; });
  for (const customPrompt of ['a'.repeat(6001), {}, 7, null]) {
    await assert.rejects(() => f.host.analyzePaperWithAI('invalid', { customPrompt }), /补充提示词/);
  }
  assert.equal(calls, 0);
});

test('missing source fields recover only from unique long quotes in submitted material and never override conflicting provenance', async () => {
  const f = llmFixture(async () => ({ kind: 'completed', text: JSON.stringify({ sections: { findings: [
    { text: 'Unique long quote', basis: 'paper', quote: 'The experiment shows enhanced emission.' },
    { text: 'Conflicting ID', basis: 'paper', sourceId: 'WRONG', quote: 'The experiment shows enhanced emission.' },
    { text: 'Conflicting source', basis: 'paper', source: 'note', quote: 'The experiment shows enhanced emission.' },
    { text: 'Short phrase', basis: 'paper', quote: 'enhanced emission' },
  ] } }) }));
  const paper = f.paper('RECOV001'), ref = `zotero://select/library/items/${paper.key}`;
  let preview = await f.host.preparePaperAnalysis(ref);
  const result = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId });
  assert.equal(result.sections.findings[0].sourceRecovery, true);
  assert.equal(result.sections.findings[0].sourceId, 'AB');
  assert.equal(result.sections.findings[0].basis, 'paper');
  for (const claim of result.sections.findings.slice(1)) assert.equal(claim.sourceRecovery, false);
  f.host.serializeZoteroItem = item => ({ title: item.title, zoteroUri: ref, abstract: 'The experiment shows enhanced emission.',
    notes: [{ text: 'The experiment shows enhanced emission.' }], annotations: [] });
  preview = await f.host.preparePaperAnalysis(ref);
  const ambiguous = await f.host.analyzePaperWithAI(ref, { preparedId: preview.preparedId, sources: { notes: true } });
  assert.equal(ambiguous.sections.findings[0].sourceRecovery, false);
});

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
  await f.host.captureWorkspaceOnClose({_mindflowCaptureState:()=>({doc:{...first,root:{...first.root,internalLink:{documentId:first.id,nodeId:first.root.id}},title:'unsaved close',metadata:{zoteroItemKey:'PAPERAAA',zoteroAttachmentKey:'ATTACHAA'}}})});
  const records=await f.host.workspaceStorage('getAll');const copy=Object.values(records).map(JSON.parse).find(d=>d.title?.includes('关闭恢复副本'));
  assert.equal(copy.metadata.autoSyncToZotero,false);assert.equal(copy.metadata.zoteroAttachmentKey,undefined);
  assert.equal(copy.root.internalLink.documentId, copy.id);
  assert.equal(JSON.parse(records.mindflow_doc_doc_a).title,'other window');
});
test('host rejects duplicate nodes and unsafe IDs before any write', async () => {
  const f=fixture(),doc=f.map();doc.root.children=[{...doc.root}];
  await assert.rejects(()=>f.host.workspaceStorage('commitDocument',{doc,expectedRevision:0}),/重复/);
  await assert.rejects(()=>f.host.workspaceStorage('commitDocument',{doc:{...f.map(),id:'../unsafe'},expectedRevision:0}),/结构|存储键/);
  assert.equal(f.disk.size,0);
});
test('host storage applies the same strict document-shape checks before any write', async () => {
  const f=fixture();
  const invalidDocuments = [
    { ...f.map(), themeId: undefined },
    { ...f.map(), revision: -1 },
    { ...f.map(), root: { ...f.map().root, task: { status: 'done', progress: 101 } } },
    { ...f.map(), root: { ...f.map().root, image: { dataUrl: 'data:image/gif;base64,AAAA', width: 200, aspectRatio: 1 } } },
    { ...f.map(), root: { ...f.map().root, internalLink: { documentId: '' } } },
    { ...f.map(), relationships: [{ id: 'same', fromId: 'root', toId: 'root' }, { id: 'same', fromId: 'root', toId: 'root' }] },
    { ...f.map(), relationships: [{ id: 'dangling', fromId: 'missing', toId: 'root' }] },
  ];
  for (const doc of invalidDocuments) {
    await assert.rejects(() => f.host.workspaceStorage('commitDocument', { doc, expectedRevision: 0 }));
  }
  assert.equal(f.disk.size, 0);
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

test('toolbar button excludes dialog windows such as plugin market', () => {
  const f = fixture();
  let created = false;
  const dialogDoc = {
    getElementById: () => null,
    querySelector: () => ({ parentNode: null }),
    querySelectorAll: () => [],
    createElement: () => { created = true; return { setAttribute() {}, remove() {} }; },
    documentElement: { getAttribute: (k) => k === 'windowtype' ? 'zotero:market' : null }
  };
  const dialogWin = { document: dialogDoc };
  f.host.addToWindow(dialogWin);
  assert.equal(created, false);
});



test('restoreDeleted only revives tombstones and cannot overwrite a concurrent document', async () => {
  const f = fixture(), doc = f.map('doc_restore_guard', 'current');
  const saved = await f.host.workspaceStorage('commitDocument', { doc, expectedRevision: 0 });
  await assert.rejects(() => f.host.workspaceStorage('commitDocument', { doc: { ...doc, title: 'stale backup' }, expectedRevision: 0, restoreDeleted: true }), /REVISION_CONFLICT/);
  assert.equal(JSON.parse(await f.host.workspaceStorage('get', { key: 'mindflow_doc_' + doc.id })).title, 'current');
  await f.host.workspaceStorage('deleteDocument', { id: doc.id, expectedRevision: saved.revision });
  const restored = await f.host.workspaceStorage('commitDocument', { doc, expectedRevision: 0, restoreDeleted: true });
  assert.equal(restored.title, 'current');
  assert.equal(await f.host.workspaceStorage('get', { key: 'mindflow_deleted_doc_' + doc.id }), null);
});

test('snapshot corruption and duplicate additions never overwrite snapshot storage', async () => {
  const f = fixture(), doc = f.map('doc_snapshot_guard', 'snapshot');
  const snap = { id: 'one', docId: doc.id, title: 'snapshot', timestamp: 1, data: JSON.stringify(doc) };
  await assert.rejects(() => f.host.workspaceStorage('mutateSnapshots', { docId: doc.id, snapshots: [snap, snap] }), /重复/);
  const key = 'mindflow_snapshots_' + doc.id;
  await f.host.workspaceStorage('setMany', { items: { [key]: '[null]' } });
  await assert.rejects(() => f.host.workspaceStorage('mutateSnapshots', { docId: doc.id, snapshots: [snap] }), /身份|属性/);
  assert.equal(await f.host.workspaceStorage('get', { key }), '[null]');
});

test('item pane section resolves parent for literature item and sibling PDF, displays names without expanding, and allows adding map', async () => {
  const f = fixture();
  const paper = f.paper('PAPER_ITEM_PANE');
  const pdf = {
    id: 991,
    key: 'PDF991XX',
    libraryID: 1,
    parentItemID: paper.id,
    attachmentFilename: 'paper.pdf',
    title: 'paper.pdf',
    isAttachment: () => true,
    isRegularItem: () => false,
  };
  f.items.set(pdf.id, pdf);

  const mapAtt = f.attachment('MAP992XX', 1, paper.id, '/storage/992.mindflow');
  mapAtt.title = 'Deep Learning Survey (MindFlow 导图源文件)';
  paper.attachments.push(pdf.id, mapAtt.id);

  // 1. Target resolution
  assert.equal(f.host.resolveLiteratureTarget(paper)?.id, paper.id);
  assert.equal(f.host.resolveLiteratureTarget(pdf)?.id, paper.id);

  // 2. getMindflowAttachments when queried with paper or sibling PDF
  const mapsFromPaper = f.host.getMindflowAttachments(paper);
  const mapsFromPdf = f.host.getMindflowAttachments(pdf);
  assert.equal(mapsFromPaper.length, 1);
  assert.equal(mapsFromPdf.length, 1);
  assert.equal(mapsFromPaper[0].id, mapAtt.id);
  assert.equal(mapsFromPdf[0].id, mapAtt.id);

  // 3. Register section
  f.host.registerItemPaneSection();
  assert.ok(f.host.itemPaneSectionID);
  const sectionConfig = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  assert.ok(sectionConfig);

  // 4. onItemChange enables for paper and sibling PDF
  let enabled = false;
  sectionConfig.onItemChange({ item: paper, setEnabled: (v) => { enabled = v; } });
  assert.equal(enabled, true);
  enabled = false;
  sectionConfig.onItemChange({ item: pdf, setEnabled: (v) => { enabled = v; } });
  assert.equal(enabled, true);

  // 5. onRender with sibling PDF
  const body = f.doc.createElement('div');
  let summaryArg = null;
  sectionConfig.onRender({
    body,
    item: pdf,
    setSectionSummary: (s) => { summaryArg = s; }
  });

  assert.equal(summaryArg, '1');
  assert.ok(body.children.length > 0);
  const container = body.children[0];

  // Inspect the rendered content: mind map card displaying name, not expanding nodes
  const card = container.children.flatMap(c => c.children || []).find(c => c.title?.includes('Deep Learning Survey'));
  assert.ok(card, 'Mind map card should be rendered');
  assert.equal(card.title, '打开导图：Deep Learning Survey');

  // Verify clicking map card calls openMindflowAttachment
  let openedAttachment = null;
  f.host.openMindflowAttachment = (att) => { openedAttachment = att; };
  card.click?.(); // or click listener
  if (card['click']) card['click']({ preventDefault() {}, stopPropagation() {} });
  assert.equal(openedAttachment?.id, mapAtt.id);

  // Verify "+ 新增思维导图" button is present
  const addBtn = container.children.find(c => c.textContent?.includes('新增思维导图'));
  assert.ok(addBtn, 'Add mind map button must be present');

  // Verify clicking "+ 新增思维导图" invokes openMindFlow with parent paper
  let openOptions = null;
  f.host.openMindFlow = (opts) => { openOptions = opts; };
  if (addBtn['click']) addBtn['click']({ preventDefault() {}, stopPropagation() {} });
  assert.ok(openOptions);
  assert.equal(openOptions.mode, 'create_from_selection');
  assert.equal(openOptions.items[0]?.id, paper.id);
  assert.equal(openOptions.forceNew, true);
});

test('item pane refresh follows the newly selected item and stops observing after destroy', () => {
  const f = fixture();
  const first = f.paper('PAPER_FIRST');
  const second = f.paper('PAPER_SECOND');
  f.host.registerItemPaneSection();
  const section = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  const body = f.doc.createElement('div');
  let renderCount = 0;
  const originalReplaceChildren = body.replaceChildren;
  body.replaceChildren = function (...children) { renderCount += 1; return originalReplaceChildren.apply(this, children); };
  section.onRender({ body, item: first });
  section.onItemChange({ item: second, setEnabled() {} });
  const create = body.children[0].children.find(node => node.localName === 'button');
  let options = null;
  f.host.openMindFlow = value => { options = value; };
  create.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(options.items[0].id, second.id);
  const countAtDestroy = renderCount;
  section.onDestroy({ body });
  f.Zotero.Notifier.trigger('modify', 'item', [second.id]);
  assert.equal(renderCount, countAtDestroy);
});

test('item pane stays expandable without a literature selection and creates a blank map', () => {
  const f = fixture();
  f.host.registerItemPaneSection();
  const section = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  let enabled = false;
  section.onItemChange({ item: null, setEnabled: value => { enabled = value; } });
  assert.equal(enabled, true);

  const body = f.doc.createElement('div');
  section.onRender({ body, item: null });
  const container = body.children[0];
  const create = container.children.find(node => node.localName === 'button');
  assert.equal(create.textContent, '新建空白思维导图');
  let options = null;
  f.host.openMindFlow = value => { options = value; };
  create.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(options.mode, 'create_blank');
  assert.equal(options.forceNew, true);
});

test('item-pane reopens its empty quick-action section after Zotero restores saved collapsed state', () => {
  const f = fixture();
  f.host.registerItemPaneSection();
  const section = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  const collapsible = { empty: true, open: false };
  const body = Object.assign(f.doc.createElement('div'), { parentElement: collapsible, isConnected: true });
  let expand;
  f.doc.defaultView = { requestAnimationFrame: callback => { expand = callback; } };
  section.onInit({ doc: f.doc, body });
  assert.equal(collapsible.empty, false);
  assert.equal(collapsible.open, true);
  collapsible.open = false;
  expand();
  assert.equal(collapsible.empty, false);
  assert.equal(collapsible.open, true);
});

test('sidebar quick actions follow the selected PDF parent and keep standalone imports unlinked', async () => {
  const f = fixture(), paper = f.paper('QUICK001');
  const pdf = f.attachment('QUICKPDF', 1, paper.id, '/storage/paper.pdf');
  pdf.attachmentFilename = 'paper.pdf';
  paper.attachments.push(pdf.id);
  f.host.registerItemPaneSection();
  const config = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  const body = f.doc.createElement('div');
  config.onRender({ body, item: pdf });
  const all = node => [node, ...node.children.flatMap(all)];
  const action = id => all(body).find(node => node.attrs['data-mindflow-action'] === id);
  const opened = [];
  f.host.openMindFlow = options => opened.push(options);
  await action('ai').click();
  assert.equal(opened[0].mode, 'ai_analyze');
  assert.equal(opened[0].items[0].id, paper.id);
  await action('workspace').click();
  await action('import').click();
  await action('blank').click();
  assert.deepEqual(opened.slice(1).map(o => o.mode), ['open', 'import_file', 'create_blank']);
  assert.ok(opened.slice(1).every(o => !o.items));
  assert.equal(action('pdf').disabled, false);
  let readerID;
  f.Zotero.Reader = { open: id => { readerID = id; } };
  await action('pdf').click();
  assert.equal(readerID, pdf.id);
  config.onItemChange({ item: null, setEnabled() {} });
  assert.equal(action('ai').disabled, true);
  assert.equal(action('pdf').disabled, true);
  await action('ai').click();
  assert.equal(opened.length, 4, 'disabled AI action must not open another paper');
  assert.equal(action('import').disabled, false);
});

test('sidebar errors are visible and repeated renders register only one refresh per body', async () => {
  const f = fixture(), paper = f.paper('QUICK002');
  f.host.registerItemPaneSection();
  const config = f.Zotero.ItemPaneManager.sections.get(f.host.itemPaneSectionID);
  const body = f.doc.createElement('div');
  config.onRender({ body, item: paper });
  config.onRender({ body, item: paper });
  const actions = body.children[0].children.find(node => node.className === 'mindflow-pane-actions');
  const ai = actions.children.find(node => node.attrs['data-mindflow-action'] === 'ai');
  f.host.openMindFlow = async () => { throw new Error('simulated open failure'); };
  await ai.click();
  assert.equal(ai.disabled, false);
  assert.equal(body.children[0].children.find(node => node.attrs.role === 'status').textContent, '操作失败，请重试。');
  let count = 0;
  const replace = body.replaceChildren;
  body.replaceChildren = function (...children) { count++; return replace.apply(this, children); };
  f.Zotero.Notifier.trigger('modify', 'item', [paper.id]);
  assert.equal(count, 1);
});

test('import shortcut queues before readiness and dispatches again in an existing workspace', () => {
  const f = fixture();
  f.host.openMindFlow({ mode: 'open' }, f.win);
  const tab = f.tabs._tabs.find(tab => tab.type === 'mindflow');
  const frame = f.tabs.getTabContent(tab.id).children[0];
  tab.data.targetItemId = 'attachment:1:LOADED01';
  f.host.openMindFlow({ mode: 'open' }, f.win);
  assert.equal(f.tabs._tabs.filter(tab => tab.type === 'mindflow').length, 1, 'workspace navigation must preserve its loaded editor');
  f.host.openMindFlow({ mode: 'import_file' }, f.win);
  assert.equal(frame._mindflowPending.action.mode, 'import_file');
  frame._mindflowReady = true;
  f.host.openMindFlow({ mode: 'import_file' }, f.win);
  assert.equal(frame.contentWindow.messages.at(-1).action.mode, 'import_file');
  assert.equal(f.tabs._tabs.filter(tab => tab.type === 'mindflow').length, 1);
});

test('privileged message ownership excludes unknown and closed editor windows', () => {
  const f = fixture();
  assert.equal(f.host.ownsWorkspaceWindow(f.win), false);
  f.host.openMindFlow({ mode: 'open' }, f.win);
  const tab = f.tabs._tabs.find(tab => tab.type === 'mindflow');
  const frame = f.tabs.getTabContent(tab.id).children[0];
  assert.equal(f.host.ownsWorkspaceWindow(frame.contentWindow), true);
  const standalone = { closed: false };
  f.host._standaloneWindows = new Map([['workspace', standalone]]);
  assert.equal(f.host.ownsWorkspaceWindow(standalone), true);
  standalone.closed = true;
  assert.equal(f.host.ownsWorkspaceWindow(standalone), false);
  assert.equal(f.host.ownsWorkspaceWindow({}), false);
});
