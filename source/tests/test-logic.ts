import { requestWebDAV } from '../src/services/sync/webdavRequest';
import assert from 'node:assert/strict';
import { cloneTree, replaceNodeText, replaceAllNodeText, expandAncestors, deleteNode } from '../src/core/model/treeOps';
import { validRelationships, captureNodeDrafts, retargetDocumentLinks } from '../src/core/model/editorState';
import { HistoryManager } from '../src/core/history/historyManager';
import { InboxService } from '../src/services/storage/inboxService';
import { SettingsService } from '../src/services/storage/settingsService';
import { safeStorage } from '../src/services/storage/safeStorage';
import { parseOPMLString } from '../src/services/io/exporter';
import { BackupService } from '../src/services/storage/backupService';
import { WebDAVService } from '../src/services/sync/webdavService';
import type { MindMapNode, MindMapDocument } from '../src/core/model/types';

let passed = 0, failed = 0;
async function run(name: string, fn: () => unknown) {
  try { await fn(); passed++; console.log(`PASS: ${name}`); }
  catch (error) { failed++; console.error(`FAIL: ${name}: ${(error as Error).message}`); }
}
const root: MindMapNode = { id: 'root', text: 'MoS2 mos2 MOS2', note: 'MOS2 evidence', children: [], task: { status: 'todo' } };
await run('cloned tasks cannot mutate original or undo history', () => {
  const copy = cloneTree(root); copy.task!.status = 'done';
  assert.equal(root.task!.status, 'todo');
});
await run('replace-current uses the same case-insensitive matching as search', () => {
  const replaced = replaceNodeText(root, 'root', 'mos2', 'TMD');
  assert.equal(replaced.text, 'TMD TMD TMD'); assert.equal(replaced.note, 'TMD evidence');
});
await run('replace-all counts actual case-insensitive occurrences', () => {
  const replaced = replaceAllNodeText(root, 'mos2', 'TMD');
  assert.equal(replaced.count, 4); assert.equal(replaced.newRoot.text, 'TMD TMD TMD');
});
await run('concurrent inbox additions preserve both records', async () => {
  safeStorage.removeItem('mindflow_inbox_items');
  await Promise.all([InboxService.addItem('first'), InboxService.addItem('second')]);
  assert.equal((await InboxService.getItems()).length, 2);
});
await run('corrupt inbox entries are rejected before rendering', async () => {
  safeStorage.setItem('mindflow_inbox_items', '[{"id":"broken","text":23}]');
  await assert.rejects(() => InboxService.getItems(), /无效|损坏/);
  safeStorage.removeItem('mindflow_inbox_items');
});
await run('concurrent setting edits merge different fields', async () => {
  await SettingsService.resetSettings();
  await Promise.all([SettingsService.updateSettings({ soundEffects: false }), SettingsService.updateSettings({ rainbowBranches: true })]);
  const settings = await SettingsService.getSettings();
  assert.equal(settings.soundEffects, false); assert.equal(settings.rainbowBranches, true);
});
await run('settings read and reset return independent nested values', async () => {
  const settings = await SettingsService.resetSettings();
  settings.webdav.serverUrl = 'https://mutated.invalid';
  assert.equal((await SettingsService.getSettings()).webdav.serverUrl, '');
  await SettingsService.resetSettings();
  const read = await SettingsService.getSettings();
  read.webdav.serverUrl = 'https://mutated.invalid';
  assert.equal((await SettingsService.getSettings()).webdav.serverUrl, '');
});
await run('malformed OPML does not silently become a successful empty map', () => {
  assert.throws(() => parseOPMLString('<opml><body><outline text="Lost"></body></opml>'), /OPML|XML|闭合/);
});
await run('backup rejects duplicate inbox IDs before any writes', async () => {
  const item = { id: 'dup', text: 'a', createdAt: 1, isProcessed: false };
  await assert.rejects(() => BackupService.previewFullWorkspaceData({ documents: [], inboxItems: [item, item] }), /重复/);
});
await run('node deletion prunes links to all deleted descendants, preserves unrelated links', () => {
  const tree = { id: 'root', text: 'root', children: [{ id: 'a', text: 'a', children: [{ id: 'nested', text: 'nested', children: [] }] }, { id: 'b', text: 'b', children: [] }] };
  const links = [{ id: 'one', fromId: 'root', toId: 'nested' }, { id: 'two', fromId: 'root', toId: 'b' }];
  const deleted = deleteNode(tree, 'a').newRoot;
  assert.deepEqual(validRelationships(deleted, links).map(link => link.id), ['two']);
});
await run('undo and redo restore the tree and relationships as one edit', () => {
  const history = new HistoryManager();
  const before = { root: { ...root, children: [{ id: 'child', text: 'c', children: [] }] }, relationships: [{ id: 'rel', fromId: 'root', toId: 'child' }] };
  const after = { root: { ...root, children: [] }, relationships: [] };
  history.push(before);
  assert.equal(JSON.stringify(history.undo(after)), JSON.stringify(before));
  assert.equal(JSON.stringify(history.redo(before)), JSON.stringify(after));
});
await run('literal replacement handles regex syntax and dollar characters literally', () => {
  const changed = replaceNodeText({ ...root, text: 'a.[x] A.[X]' }, 'root', 'a.[x]', '$&');
  assert.equal(changed.text, '$& $&');
});
await run('search reveals ancestors without expanding target or unrelated branches', () => {
  const tree = { ...root, isExpanded: false, children: [{ id: 'child', text: 'child', isExpanded: false, children: [{ id: 'target', text: 'target', isExpanded: false, children: [] }] }] };
  const expanded = expandAncestors(tree, 'target');
  assert.equal(expanded.isExpanded, true); assert.equal(expanded.children[0].isExpanded, true);
  assert.equal(expanded.children[0].children[0].isExpanded, false); assert.equal(tree.isExpanded, false);
  assert.equal(expandAncestors(tree, 'missing'), tree);
});
await run('switch/save draft capture includes latest text and ignores stale missing IDs', () => {
  const doc = { id: 'doc', root, updatedAt: 1, metadata: { autoSyncToZotero: false } } as MindMapDocument;
  const captured = captureNodeDrafts(doc, [{ id: 'root', text: ' Latest Chinese text ' }, { id: 'missing', text: 'foreign' }])!;
  assert.equal(captured.root.text, 'Latest Chinese text'); assert.equal(captured.metadata, doc.metadata);
  assert.equal(doc.root.text, 'MoS2 mos2 MOS2'); assert.ok(captured.updatedAt > 1);
});
await run('document copy remaps self links but preserves links to other documents', () => {
  const tree = { ...root, internalLink: { documentId: 'old', nodeId: 'root' }, children: [{ id: 'external', text: 'e', children: [], internalLink: { documentId: 'other' } }] };
  const copy = retargetDocumentLinks(tree, 'old', 'new');
  assert.equal(copy.internalLink?.documentId, 'new'); assert.equal(copy.children[0].internalLink?.documentId, 'other');
  assert.equal(tree.internalLink.documentId, 'old');
});
await run('partial WebDAV updates preserve other concurrent fields', async () => {
  await SettingsService.resetSettings();
  await Promise.all([SettingsService.updateSettings({ webdav: { lastSyncStatus: 'success' } }),
    SettingsService.updateSettings({ webdav: { lastSyncMessage: 'done' } }),
    SettingsService.updateSettings({ webdav: { lastSyncTime: 123 } })]);
  const settings = await SettingsService.getSettings();
  assert.equal(settings.webdav.lastSyncStatus, 'success'); assert.equal(settings.webdav.lastSyncMessage, 'done');
  assert.equal(settings.webdav.lastSyncTime, 123); assert.equal(settings.webdav.serverUrl, '');
});
await run('inbox merge, processing and additions cannot overwrite each other', async () => {
  safeStorage.removeItem('mindflow_inbox_items');
  const first = await InboxService.addItem('one');
  await Promise.all([InboxService.markProcessed(first.id), InboxService.addItem('two'),
    InboxService.mergeItems([{ id: 'restored', text: 'restored', createdAt: 1, isProcessed: false }])]);
  const items = await InboxService.getItems();
  assert.equal(items.length, 3); assert.equal(items.find(item => item.id === first.id)?.isProcessed, true);
  await InboxService.clearProcessed(); assert.equal((await InboxService.getItems()).length, 2);
});
await run('queued WebDAV autosync is invalidated by disabled service or changed credentials', async () => {
  const config = (await SettingsService.getSettings()).webdav;
  assert.equal(WebDAVService.sameAutoSyncConfig(config, { ...config, lastSyncTime: 999 }), true);
  assert.equal(WebDAVService.sameAutoSyncConfig(config, { ...config, enabled: !config.enabled }), false);
  assert.equal(WebDAVService.sameAutoSyncConfig(config, { ...config, password: 'changed' }), false);
  assert.equal(WebDAVService.sameAutoSyncConfig(config, { ...config, serverUrl: 'https://different.invalid' }), false);
});
await run('WebDAV timeout rejects even when the transport ignores abort', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
  try { await assert.rejects(() => requestWebDAV('https://example.invalid', { method: 'PUT' }, { timeoutMs: 20 }), /超时/); }
  finally { globalThis.fetch = original; }
});
await run('WebDAV deadline includes a response body that stalls after headers', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new ReadableStream({ start() {} }), { status: 200 })) as typeof fetch;
  try { await assert.rejects(() => requestWebDAV('https://example.invalid', { method: 'GET' }, { timeoutMs: 20 }), /超时/); }
  finally { globalThis.fetch = original; }
});
await run('WebDAV preserves caller cancellation separately from its timeout', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
  const caller = new AbortController();
  try {
    const pending = requestWebDAV('https://example.invalid', { method: 'GET', signal: caller.signal }, { timeoutMs: 1000 });
    caller.abort();
    await assert.rejects(() => pending, (error: any) => error?.name === 'AbortError');
  } finally { globalThis.fetch = original; }
});
await run('WebDAV streamed bodies without content length stop at the byte limit', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('中文中文', { status: 200 })) as typeof fetch;
  try { await assert.rejects(() => requestWebDAV('https://example.invalid', { method: 'GET' }, { maxBytes: 6 }), /上限/); }
  finally { globalThis.fetch = original; }
});
await run('WebDAV 204 connection checks do not fabricate an invalid response body', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  try { assert.equal((await requestWebDAV('https://example.invalid', { method: 'PROPFIND' })).status, 204); }
  finally { globalThis.fetch = original; }
});
await run('failed WebDAV directory creation stops before uploading any backup', async () => {
  const original = globalThis.fetch, calls: string[] = [];
  globalThis.fetch = (async (_url, init) => { calls.push(init?.method || 'GET'); return new Response(null, { status: 403 }); }) as typeof fetch;
  const config = { ...(await SettingsService.getSettings()).webdav, serverUrl: 'https://example.invalid/dav/', username: 'u', basePath: '/maps/' };
  try {
    const result = await WebDAVService.uploadBackup(config, { documents: [] } as any);
    assert.equal(result.success, false); assert.deepEqual(calls, ['MKCOL']);
  } finally { globalThis.fetch = original; }
});
await run('WebDAV backup path cannot escape the configured server directory', () => {
  assert.equal(WebDAVService.buildUrl('https://example.invalid/dav/', '/maps/archive.json'),
    'https://example.invalid/dav/maps/archive.json');
  for (const path of ['../outside.json', '%2e%2e/outside.json', 'maps\\outside.json',
    'maps/archive.json?redirect=1', 'maps/%2foutside.json']) {
    assert.throws(() => WebDAVService.buildUrl('https://example.invalid/dav/', path), /目标路径/);
  }
});
await run('WebDAV creates nested backup directories in parent-first order', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url) => {
    calls.push(String(url));
    return new Response(null, { status: calls.length === 1 ? 405 : 201 });
  }) as typeof fetch;
  const config = { ...(await SettingsService.getSettings()).webdav,
    serverUrl: 'https://example.invalid/dav/', username: 'u', basePath: '/research/maps/' };
  try {
    assert.equal(await WebDAVService.ensureRemoteFolder(config), true);
    assert.deepEqual(calls, ['https://example.invalid/dav/research/', 'https://example.invalid/dav/research/maps/']);
  } finally { globalThis.fetch = original; }
});
await run('oversize WebDAV backup is rejected before any remote request', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests++; return new Response(null, { status: 201 }); }) as typeof fetch;
  const config = { ...(await SettingsService.getSettings()).webdav,
    serverUrl: 'https://example.invalid/dav/', username: 'u', basePath: '/maps/' };
  try {
    const result = await WebDAVService.uploadBackup(config,
      { documents: [{ title: 'x'.repeat(20 * 1024 * 1024) }] } as any);
    assert.equal(result.success, false);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = original; }
});
await run('queued WebDAV upload freezes credentials, destination and document contents', async () => {
  const original = globalThis.fetch, calls: Array<{url: string; method: string; body: string; auth: string}> = [];
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: String(init?.body || ''), auth: (init?.headers as any)?.Authorization });
    return new Response(null, { status: 201 });
  }) as typeof fetch;
  const config = { ...(await SettingsService.getSettings()).webdav, serverUrl: 'https://example.invalid/dav/', username: 'original', password: 'before', basePath: '/maps/' };
  const data = { documents: [{ title: 'original' }] } as any;
  try {
    const pending = WebDAVService.uploadBackup(config, data);
    config.serverUrl = 'https://changed.invalid'; config.password = 'after'; data.documents[0].title = 'changed';
    assert.equal((await pending).success, true);
    const uploads = calls.filter(call => call.method === 'PUT');
    assert.equal(uploads.length, 2);
    for (const call of uploads) {
      assert.ok(call.url.startsWith('https://example.invalid/dav/maps/'));
      assert.equal(JSON.parse(call.body).documents[0].title, 'original');
      assert.equal(call.auth, 'Basic ' + btoa('original:before'));
    }
  } finally { globalThis.fetch = original; }
});
console.log(`${passed} logic tests passed; ${failed} failed`);
if (failed) process.exitCode = 1;
