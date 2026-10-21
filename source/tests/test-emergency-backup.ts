import assert from 'node:assert/strict';
import { emergencyDocument } from '../src/core/model/emergencyBackup';
import { exportToJSON } from '../src/services/io/exporter';
import { validateMindMapDocument } from '../src/services/storage/documentValidation';
import { CanvasErrorBoundary } from '../src/components/canvas/CanvasErrorBoundary';
import type { MindMapDocument } from '../src/core/model/types';

const document: MindMapDocument = {
  id: 'recovery_original', revision: 17, title: '应急备份验证',
  themeId: 'academic-paper', layoutType: 'logic-right', createdAt: 100, updatedAt: 200,
  root: { id: 'root', text: '原主题', note: '根节点备注', children: [
    { id: 'child', text: '分支', note: '多行\n备注', children: [], task: { status: 'doing', priority: 2 } },
  ] },
  relationships: [],
  metadata: { zoteroItemKey: 'PAPER001', zoteroLibraryID: 2, attachmentKey: 'MAP00001', reviewed: true },
};
const links = [{ id: 'rel', fromId: 'root', toId: 'child', label: '证据关系', style: 'dashed' as const }];
const original = JSON.stringify(document);
const recovered = emergencyDocument(document, links,
  { documentId: document.id, id: 'root', text: '尚未提交的中文草稿' })!;
assert.equal(recovered.root.text, '尚未提交的中文草稿');
assert.deepEqual(recovered.relationships, links);
assert.deepEqual(recovered.metadata, document.metadata);
for (const field of ['id', 'revision', 'title', 'themeId', 'layoutType', 'createdAt'] as const) {
  assert.equal(recovered[field], document[field]);
}
assert.equal(JSON.stringify(document), original, 'recovery must not mutate the live document');
assert.equal(emergencyDocument(document, [], { documentId: 'another', id: 'root', text: 'wrong' })!.root.text, '原主题');
assert.equal(emergencyDocument(document, [], { documentId: document.id, id: 'deleted', text: 'wrong' })!.root.text, '原主题');
assert.equal(emergencyDocument(document, [], null)!.relationships!.length, 0, 'deleting the last relation must not resurrect stale links');
assert.equal(emergencyDocument(null, links, null), null);
console.log('PASS: full recovery identity, latest links, pending draft, source isolation and immutability');

let downloaded: Blob | null = null;
let filename = '';
let failDownload = false;
const globals = globalThis as any;
const saved = { document: globals.document, window: globals.window, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
try {
  globals.document = {
    createElement: () => ({ href: '', download: '', click() { if (failDownload) throw new Error('download unavailable'); filename = this.download; } }),
    body: { appendChild() {}, removeChild() {} },
  };
  globals.window = { setTimeout: (fn: () => void) => { fn(); return 0; } };
  URL.createObjectURL = (blob: Blob) => { downloaded = blob; return 'blob:recovery'; };
  URL.revokeObjectURL = () => {};
  exportToJSON(recovered);
  const imported = validateMindMapDocument(JSON.parse(await (downloaded! as Blob).text()));
  assert.deepEqual(imported, JSON.parse(JSON.stringify(recovered)));
  assert.equal(filename, '应急备份验证.mindflow.json');
  console.log('PASS: actual JSON exporter round-trips all document fields through the import validator');

  const boundary = new CanvasErrorBoundary({ children: null, getDocument: () => recovered });
  boundary.setState = ((patch: any) => { boundary.state = { ...boundary.state, ...patch }; }) as any;
  (boundary as any).handleEmergencyExport();
  assert.equal(boundary.state.exportFailed, false);
  assert.match(boundary.state.exportMessage, /请确认文件已保存/);
  failDownload = true;
  (boundary as any).handleEmergencyExport();
  assert.equal(boundary.state.exportFailed, true);
  assert.match(boundary.state.exportMessage, /download unavailable/);
  console.log('PASS: download failure replaces success feedback and stays retryable');
} finally {
  globals.document = saved.document;
  globals.window = saved.window;
  URL.createObjectURL = saved.create;
  URL.revokeObjectURL = saved.revoke;
}
