import assert from 'node:assert/strict';
import { ResearchPresetService as service, defaultResearchPresetConfig, validateResearchPresetConfig } from '../src/services/zotero/researchPresets';
import { safeStorage } from '../src/services/storage/safeStorage';
import { createResearchDocument, requestResearchAnalysis } from '../src/services/zotero/researchAnalysis';

let count = 0;
const run = async (name: string, fn: () => unknown) => { await fn(); console.log(`PASS ${++count}: ${name}`); };
const key = 'mindflow_research_presets_v1';
await run('old installations start with no preset and inherit appearance', () => {
  assert.deepEqual(service.read(), { version: 1, defaultId: '', presets: [] });
  assert.equal(defaultResearchPresetConfig().presentation, null);
});
await run('named prompt, content template and presentation survive rereading and default selection', () => {
  const store = service.save('材料机理', { templateId: 'experimental-evidence', customPrompt: '  保留数值与对照  ',
    presentation: { themeId: 'paper-reading', layoutType: 'logic-right' } });
  service.setDefault(store.presets[0].id);
  const loaded = service.read();
  assert.equal(loaded.defaultId, loaded.presets[0].id);
  assert.equal(loaded.presets[0].customPrompt, '保留数值与对照');
  assert.equal(loaded.presets[0].presentation?.layoutType, 'logic-right');
  loaded.presets[0].name = 'local mutation';
  assert.equal(service.read().presets[0].name, '材料机理');
});
await run('stale catalog does not lose newly added records; update and delete use current storage', () => {
  const stale = service.read(); service.save('另一个窗口', defaultResearchPresetConfig());
  service.save('更名', defaultResearchPresetConfig(), stale.presets[0].id);
  assert.equal(service.read().presets.length, 2);
  service.remove(stale.presets[0].id);
  assert.equal(service.read().defaultId, '');
  assert.equal(service.read().presets[0].name, '另一个窗口');
  assert.throws(() => service.save('stale update', defaultResearchPresetConfig(), stale.presets[0].id), /已被删除/);
});
await run('invalid preset values cannot replace persisted configuration', () => {
  const before = safeStorage.getItem(key);
  for (const bad of [ { ...defaultResearchPresetConfig(), templateId: 'unknown' },
    { ...defaultResearchPresetConfig(), customPrompt: 'a'.repeat(6001) },
    { ...defaultResearchPresetConfig(), presentation: { themeId: '__proto__', layoutType: 'mindmap' } },
    { ...defaultResearchPresetConfig(), presentation: { themeId: 'classic-blue', layoutType: 'invalid' } } ]) {
    assert.throws(() => service.save('invalid', bad as any));
  }
  assert.equal(safeStorage.getItem(key), before);
  assert.throws(() => service.save(' ', defaultResearchPresetConfig()), /名称/);
});
await run('damaged catalog is visible and preserved rather than overwritten by save', () => {
  const before = safeStorage.getItem(key)!;
  safeStorage.setItem(key, '{broken');
  assert.throws(() => service.read(), /损坏/);
  assert.throws(() => service.save('new', defaultResearchPresetConfig()), /损坏/);
  assert.equal(safeStorage.getItem(key), '{broken');
  safeStorage.setItem(key, before);
});
await run('preset limit rejects the 31st record and duplicate IDs are invalid', () => {
  while (service.read().presets.length < 30) service.save('preset', defaultResearchPresetConfig());
  assert.throws(() => service.save('extra', defaultResearchPresetConfig()), /30/);
  const store = service.read(); store.presets[1].id = store.presets[0].id;
  safeStorage.setItem(key, JSON.stringify(store));
  assert.throws(() => service.read(), /记录无效/);
  safeStorage.removeItem(key);
});
await run('prompt bridge forwards user text and generated maps retain provenance and chosen appearance', async () => {
  let forwarded: any;
  const analysis = { title: 'Test', zoteroUri: 'zotero://select/library/items/PRESET01',
    sourceScope: { pdfState: 'none', pdfTruncated: false, hasAbstract: true, noteCount: 0, annotationCount: 0,
      templateId: 'experimental-compact', customPrompt: '保留关键条件' },
    sections: { question: [{ text: '核心问题', detail: '', basis: 'inference' as const, source: 'none' as const, quote: '' }] } };
  (globalThis as any).window = { Zotero: { MindFlow: { analyzePaperWithAI: async (_ref: string, options: any) => { forwarded = options; return analysis; } } } };
  try {
    const result = await requestResearchAnalysis(analysis.zoteroUri, { customPrompt: '保留关键条件' });
    assert.equal(forwarded.customPrompt, '保留关键条件');
    const config = validateResearchPresetConfig({ ...defaultResearchPresetConfig(), presentation: { themeId: 'academic-paper', layoutType: 'org-down' } });
    const doc = createResearchDocument(result, config.presentation!);
    assert.equal(doc.themeId, 'academic-paper'); assert.equal(doc.layoutType, 'org-down');
    assert.equal(doc.metadata?.aiSourceScope.customPrompt, '保留关键条件');
    assert.equal(doc.metadata?.aiDraft, true); assert.equal(doc.metadata?.autoSyncToZotero, false);
  } finally { delete (globalThis as any).window; }
});
console.log(`${count} research preset tests passed`);
