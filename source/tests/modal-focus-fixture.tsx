// Test-only real React fixture; excluded from the runtime XPI.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AIResearchModal, type AIResearchStage } from '../src/components/modal/AIResearchModal';
import type { ResearchProgress } from '../src/services/zotero/researchAnalysis';

const root = createRoot(document.getElementById('root')!);
const calls = { close: 0, cancel: 0 };
const render = (stage: AIResearchStage = 'preparing', isOpen = true, progress: ResearchProgress | null = null) => {
  flushSync(() => root.render(<>
    <button id="modal-launcher">Open analysis</button>
    <AIResearchModal appearance={{ themeId: 'classic-blue', layoutType: 'mindmap' }} isOpen={isOpen}
      stage={stage} preview={null} progress={progress} error="test failure"
      onStart={() => {}} onRetry={() => {}} onCancel={() => { calls.cancel++; }}
      onClose={() => { calls.close++; }} onRefresh={() => {}} onSettings={() => {}} />
    <button id="outside-dialog">Outside dialog</button>
  </>));
};
(window as any).__mindflowModalTest = { render, calls };
render('preparing', false);
