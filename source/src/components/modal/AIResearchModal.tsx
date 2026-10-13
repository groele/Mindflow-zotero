import React, { useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { ResearchInputPreview, ResearchProgress, ResearchSourceSelection, ResearchModelSelection, ResearchReasoningLevel, ResearchReadingMode, ResearchAppearance } from '../../services/zotero/researchAnalysis';
import { getTheme } from '../../core/theme/themes';
import { researchTemplates, defaultResearchTemplateId, getResearchTemplate, researchSectionDefinitions } from '../../services/zotero/researchTemplates';

export type AIResearchStage = 'preparing' | 'ready' | 'running' | 'saving' | 'error';

interface AIResearchModalProps {
  appearance: ResearchAppearance;
  isOpen: boolean;
  stage: AIResearchStage;
  preview: ResearchInputPreview | null;
  progress: ResearchProgress | null;
  error: string;
  onStart: (mode: 'quick' | 'deep', sources: ResearchSourceSelection, model: ResearchModelSelection) => void;
  onRetry: (mode: 'quick' | 'deep', sources: ResearchSourceSelection, model: ResearchModelSelection) => void;
  onCancel: () => void;
  onClose: () => void;
  onRefresh: (readingMode?: ResearchReadingMode, abstractSelection?: { preparedId: string; text: string }) => void;
  onSettings: () => void;
}

export const AIResearchModal: React.FC<AIResearchModalProps> = ({
  appearance, isOpen, stage, preview, progress, error, onStart, onRetry, onCancel, onClose, onRefresh, onSettings,
}) => {
  const [mode, setMode] = useState<'quick' | 'deep'>('deep');
  const [readingMode, setReadingMode] = useState<ResearchReadingMode>('abstract');
  const [modelEntryId, setModelEntryId] = useState('');
  const [reasoningLevel, setReasoningLevel] = useState<ResearchReasoningLevel>('default');
  const [templateId, setTemplateId] = useState(defaultResearchTemplateId);
  const [abstractEditor, setAbstractEditor] = useState(false);
  const [abstractDraft, setAbstractDraft] = useState('');
  const [excerptSelection, setExcerptSelection] = useState('');
  const captureExcerptSelection = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    setExcerptSelection(target.value.slice(target.selectionStart, target.selectionEnd));
  };
  const validAbstractDraft = abstractDraft.trim().length >= 50 && abstractDraft.trim().length <= 12000;
  const template = getResearchTemplate(templateId);
  const selectedModel = preview?.models?.find((entry) => entry.entryId === modelEntryId);
  const modelSelection: ResearchModelSelection = { modelEntryId, templateId,
    reasoningLevel: selectedModel?.reasoningSupported ? reasoningLevel : 'default' };
  const [sources, setSources] = useState<ResearchSourceSelection>({
    abstract: true, pdf: true, notes: false, highlights: false, comments: false,
  });
  const scope = preview?.sourceScope;
  const partialReading = (preview?.readingMode || readingMode) !== 'full';
  const sourceRows: Array<{ key: keyof ResearchSourceSelection; label: string; available: boolean }> = [
    { key: 'abstract', label: '摘要', available: Boolean(scope?.hasAbstract) },
    { key: 'pdf', label: 'PDF 文字', available: Boolean(scope?.pdfCharacters) },
    { key: 'notes', label: `Zotero 笔记（${scope?.noteCount || 0} 条）`, available: Boolean(scope?.noteCount) },
    { key: 'highlights', label: `批注划线（${scope?.highlightCount || 0} 条）`, available: Boolean(scope?.highlightCount) },
    { key: 'comments', label: `读者评论（${scope?.commentCount || 0} 条）`, available: Boolean(scope?.commentCount) },
  ];
  const enabledSources: ResearchSourceSelection = {
    abstract: sources.abstract && Boolean(scope?.hasAbstract),
    pdf: sources.pdf && Boolean(scope?.pdfCharacters),
    notes: sources.notes && Boolean(scope?.noteCount),
    highlights: sources.highlights && Boolean(scope?.highlightCount),
    comments: sources.comments && Boolean(scope?.commentCount),
  };
  const selectedCharacters = sourceRows.reduce((sum, row) => sum +
    (enabledSources[row.key] ? preview?.sourceCharacters?.[row.key] || 0 : 0), 0);
  const hasSelectedContent = Object.values(enabledSources).some(Boolean);
  const hasAvailableContent = sourceRows.some(row => row.available);
  const emptySourceMessage = preview?.readingMode === 'abstract'
    ? '当前为“仅摘要”模式。该条目的摘要字段为空，且本次未能从 PDF 可靠提取摘要；正文未纳入分析。'
    : scope?.sectionStatus?.missing.length
      ? '当前范围未提取到可分析的文字，所选章节未可靠识别。可以选择其他读取范围。'
      : '当前范围没有可分析的资料。请检查所选文献及关联 PDF 是否已下载、有可提取的文字。';
  const busy = stage === 'preparing' || stage === 'running' || stage === 'saving';
  const dialogRef = React.useRef<HTMLElement>(null);
  const previewPaperRef = React.useRef('');
  // Initialize a new preview before controls can receive input. A delayed
  // passive effect could overwrite a user's freshly selected model.
  React.useLayoutEffect(() => {
    if (preview?.preparedId) {
      setAbstractEditor(false);
      setAbstractDraft(preview.abstractText || '');
      setExcerptSelection('');
      const samePaper = previewPaperRef.current === preview.zoteroUri;
      previewPaperRef.current = preview.zoteroUri;
      if (!samePaper) setSources({ abstract: true, pdf: true, notes: false, highlights: false, comments: false });
      setReadingMode(preview.readingMode);
      const model = samePaper && preview.models.find(entry => entry.entryId === modelEntryId && entry.available) ||
        preview.models.find(entry => entry.entryId === preview.defaultModelEntryId && entry.available);
      setModelEntryId(model?.entryId || preview.defaultModelEntryId);
      if (!samePaper || model?.entryId !== modelEntryId || !model?.reasoningSupported ||
          !model.reasoningOptions.some(option => option.id === reasoningLevel)) setReasoningLevel('default');
    }
  }, [preview?.preparedId]);
  React.useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')?.focus();
    return () => previous?.focus();
  }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (stage !== 'saving') (busy ? onCancel : onClose)();
      } else if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || []);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, stage, busy, onCancel, onClose]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      role="presentation">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-research-title"
        className="flex max-h-[min(760px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Sparkles size={18} /><span className="text-xs font-semibold">Zotero 论文研究导图</span>
            </div>
            <h2 id="ai-research-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {stage === 'preparing' ? '正在整理论文资料' : stage === 'running' ? '正在分析论文' :
                stage === 'saving' ? '正在保存草稿' :
                stage === 'error' ? '分析尚未完成' : '确认分析范围'}
            </h2>
          </div>
          <button type="button" onClick={busy && stage !== 'saving' ? onCancel : onClose}
            disabled={stage === 'saving'} aria-label={busy ? '取消分析' : '关闭'}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </header>

        <div className="shrink-0 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <label className="block text-xs font-semibold text-slate-900 dark:text-white">文章读取范围
            <select aria-label="文章读取范围" value={readingMode} disabled={busy}
              onChange={event => { const value = event.target.value as ResearchReadingMode; setReadingMode(value); onRefresh(value); }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800">
              <option value="abstract">仅摘要 · 最省输入</option><option value="introduction">仅引言</option>
              <option value="conclusion">仅结论</option><option value="key-sections">摘要＋引言＋结论</option>
              <option value="full">全文 · 适合精读与复现</option>
            </select>
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-500">读取范围决定发送的正文；快速／深入分析不会扩大范围。章节未识别时不回退全文。</p>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 text-sm text-slate-700 dark:text-slate-200">
          {stage === 'preparing' && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
              <Loader2 className="animate-spin text-blue-600" size={19} />
              <span>正在本机整理所选范围的资料；仅摘要优先读取条目摘要，缺失时在 PDF 前几页定位摘要。此阶段不向模型发送资料。</span>
            </div>
          )}
          {preview && (
            <>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start gap-2 font-semibold text-slate-900 dark:text-white">
                  <BookOpen size={18} className="mt-0.5 shrink-0 text-blue-600" />
                  <span className="break-words">{preview.title}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <span>摘要：{scope?.hasAbstract ? scope.abstractSource === 'pdf' ? '已从 PDF 提取' : scope.abstractSource === 'pdf-selected' ? '已选取 PDF 摘要' : scope.abstractSource === 'manual' ? '已补充，来源待核对' : '本次可用' : scope?.paperHasAbstract ? '未纳入当前范围' : '该条目摘要为空'}</span>
                  <span>PDF：{scope?.pdfState}</span>
                  {scope?.pdfAttachmentTitle && <span className="min-w-0 break-words sm:col-span-2">读取附件：{scope.pdfAttachmentTitle}</span>}
                  <span>笔记：{scope?.noteCount || 0} 条{scope?.omittedNotes ? `，另有 ${scope.omittedNotes} 条未纳入` : ''}</span>
                  <span>批注：{scope?.annotationCount || 0} 条{scope?.omittedAnnotations ? `，另有 ${scope.omittedAnnotations} 条未纳入` : ''}</span>
                  <span className="sm:col-span-2">归档：{preview.archiveState}</span>
                  <span className="sm:col-span-2">本次准备：{preview.estimatedCharacters.toLocaleString()} 字符（字符数不是精确 token 数）；PDF 纳入 {scope?.pdfCharacters || 0} 字符。</span>
                </div>
                {Boolean(scope?.sectionStatus?.missing.length) && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  未可靠识别：{scope?.sectionStatus?.missing.map(section => ({ abstract: '摘要', introduction: '引言', conclusion: '结论' } as Record<string, string>)[section] || section).join('、')}。这些部分未发送；可改选其他范围。
                </p>}
                {scope && Boolean(scope.abstractTruncated || scope.trimmedNotes || scope.trimmedHighlights || scope.trimmedComments) &&
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    长内容已截取：{[
                      scope.abstractTruncated ? '摘要' : '',
                      scope.trimmedNotes ? `${scope.trimmedNotes} 条笔记` : '',
                      scope.trimmedHighlights ? `${scope.trimmedHighlights} 条划线` : '',
                      scope.trimmedComments ? `${scope.trimmedComments} 条评论` : '',
                    ].filter(Boolean).join('、')}。请对照原始资料核验。
                  </p>}
                {scope && Boolean(scope.noteReadErrors || scope.annotationReadErrors) &&
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    读取异常：笔记 {scope.noteReadErrors || 0} 处，批注 {scope.annotationReadErrors || 0} 处；受影响的内容未进入本次预览。
                  </p>}
                {scope?.pdfTruncated && Boolean(scope.pdfCharacters) && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  PDF 超出读取范围或已跨区间采样；导图会标注资料不完整。
                </p>}
              </div>

              {(stage === 'ready' || stage === 'error') && (
                <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <legend className="px-1 font-semibold text-slate-900 dark:text-white">分析框架与内容组织</legend>
                  <label className="block text-xs">论文类型
                    <select aria-label="论文分析框架" value={template.family} disabled={busy}
                      onChange={event => setTemplateId(event.target.value === 'experimental' ? defaultResearchTemplateId : event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                      <option value="experimental">实验研究</option><option value="theoretical">理论与计算</option>
                      <option value="mechanism">机理辨析</option><option value="review">综述与对比</option>
                    </select>
                  </label>
                  {template.family === 'experimental' && <label className="block text-xs">实验论文内容模板
                    <select aria-label="实验论文内容模板" value={templateId} disabled={busy}
                      onChange={event => setTemplateId(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                      {researchTemplates.filter(entry => entry.family === 'experimental').map(entry =>
                        <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </select>
                  </label>}
                  <p className="text-xs leading-5 text-slate-500">{template.description} {template.framework}</p>
                  <div className="flex flex-wrap gap-1.5" aria-label="导图内容范围">
                    {template.keys.map(key => <span key={key} className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                      {researchSectionDefinitions[key].label}</span>)}
                  </div>
                  <p className="text-xs text-slate-500">{template.style === 'story' ? '最多五条主线、三个核心发现 · 省去单子节点分类层 · 补充资料保留在备注' : `${template.keys.length} 个固定分支 · 数值与单位保留，缺失内容标为待补充。`}</p>
                  <p aria-label="生成导图外观" className="text-xs text-slate-500">生成时保留当前外观：{getTheme(appearance.themeId).name} · {appearance.layoutType === 'logic-right' ? '向右逻辑图' : appearance.layoutType === 'org-down' ? '向下层级图' : '双侧思维导图'}。内容模板只决定分析逻辑和层级。</p>
                  <p className="text-xs text-slate-500">{template.style === 'story' ? '观测、条件、对照与作者解释直接显示在图中，原文及核对状态保留在备注。仅摘要无法覆盖全文证据；需要完整结果时请选择全文 PDF。' : '节点采用精炼要点：材料／参数直接列出，机理用原因→过程→结果；解释、条件与原文放在备注。绿色勾为引文匹配，问号为待核验。'}</p>
                </fieldset>
              )}

              {(stage === 'ready' || stage === 'error') && (
                <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <legend className="px-1 font-semibold text-slate-900 dark:text-white">本次使用的模型</legend>
                  <label className="block text-xs">llm-for-zotero 已配置模型
                    <select aria-label="本次分析模型" value={modelEntryId} disabled={busy}
                      onChange={(event) => { setModelEntryId(event.target.value); setReasoningLevel('default'); }}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                      {preview.models?.map((entry) => <option key={entry.entryId} value={entry.entryId} disabled={!entry.available}>
                        {entry.model}{entry.host ? ` · ${entry.host}` : ''}{entry.available ? '' : '（暂不支持）'}
                      </option>)}
                    </select>
                  </label>
                  <label className="block text-xs">推理强度
                    <select aria-label="本次推理强度" value={modelSelection.reasoningLevel}
                      disabled={busy || !selectedModel?.reasoningSupported}
                      onChange={(event) => setReasoningLevel(event.target.value as ResearchReasoningLevel)}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800">
                      {(selectedModel?.reasoningOptions || [{ id: 'default', label: '模型默认' }]).map((option) =>
                        <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <p className="text-xs leading-5 text-slate-500">仅影响本次分析。{selectedModel?.reasoningOptionsSource === 'llm-for-zotero-profile'
                    ? '选项来自该模型在 llm-for-zotero 中的能力配置，参数由该插件发送。'
                    : !selectedModel?.reasoningSupported ? '该模型未启用推理强度选择。'
                    : '推理参数由 llm-for-zotero 按模型能力映射；其公开接口未提供完整强度列表，部分选项可能采用模型默认值。'}</p>
                </fieldset>
              )}

              {(stage === 'ready' || stage === 'error') && (
                <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <legend className="px-1 font-semibold text-slate-900 dark:text-white">本次发送的资料</legend>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">取消勾选的来源不会发送给模型，也不会用于引文核对。调整范围后重新分析会使用独立的会话结果。</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sourceRows.map(({ key, label, available }) => (
                      <label key={key} className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={available && sources[key]} disabled={!available || busy}
                          onChange={(event) => setSources((current) => ({ ...current, [key]: event.target.checked }))} />
                        <span className={!available ? 'text-slate-400' : ''}>{label}</span>
                      </label>
                    ))}
                  </div>
                  {preview.readingMode === 'abstract' && <div className="mt-3 space-y-2">
                    <button type="button" aria-expanded={abstractEditor} onClick={() => setAbstractEditor(current => !current)}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                      {scope?.hasAbstract ? '核对／修改本次摘要' : '选择／补充摘要'}
                    </button>
                    {!scope?.hasAbstract && <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                      PDF 没有摘要标题时可能无法自动识别。可选取下方 PDF 前页中的摘要段落，或粘贴摘要；确认后即可勾选“摘要”。
                    </p>}
                    {abstractEditor && <div aria-label="摘要选择编辑器" className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                      {preview.abstractExcerpt && <>
                        <label className="block text-xs">PDF 前页文字（仅在本地显示，选中摘要段落后点击下方按钮）
                          <textarea aria-label="PDF 前页文字" readOnly value={preview.abstractExcerpt}
                            onSelect={captureExcerptSelection} onMouseUp={captureExcerptSelection} onKeyUp={captureExcerptSelection}
                            className="mt-2 h-40 w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-xs leading-5 dark:border-slate-600 dark:bg-slate-800" />
                        </label>
                        <button type="button" disabled={!excerptSelection.trim()} onClick={() => setAbstractDraft(excerptSelection.trim())}
                          className="rounded-lg border border-blue-300 px-3 py-2 text-xs text-blue-700 disabled:opacity-50 dark:text-blue-300">使用选中文字</button>
                      </>}
                      <label className="block text-xs">本次摘要（可粘贴或修正；请只保留摘要正文）
                        <textarea aria-label="本次摘要正文" value={abstractDraft} maxLength={12000}
                          onChange={event => setAbstractDraft(event.target.value)}
                          className="mt-2 h-36 w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-xs leading-5 dark:border-slate-600 dark:bg-slate-800" />
                      </label>
                      <p className="text-xs leading-5 text-slate-500">{abstractDraft.trim().length} 字符，需 50～12000 字符。此操作只设置本次输入；不会修改 Zotero 条目。未匹配本地原文的粘贴内容会标为待核验。</p>
                      <button type="button" disabled={!validAbstractDraft || busy} onClick={() => {
                        setSources(current => ({ ...current, abstract: true }));
                        onRefresh('abstract', { preparedId: preview.preparedId, text: abstractDraft.trim() });
                      }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-50">确认使用摘要</button>
                    </div>}
                  </div>}
                  {(!hasAvailableContent || (preview.readingMode === 'abstract' && !scope?.hasAbstract)) && <div role="alert" aria-label="无可选资料" className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <p>{emptySourceMessage}</p>
                    {Boolean(scope?.pdfAttachmentCount) && <>
                      <p>该文献有 {scope?.pdfAttachmentCount} 个 PDF 附件。可明确改选其他范围并重新准备；只发送该范围内的资料。</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.readingMode !== 'key-sections' && <button type="button" onClick={() => onRefresh('key-sections')}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs dark:border-amber-700 dark:bg-slate-800">读取摘要＋引言＋结论</button>}
                        {preview.readingMode !== 'full' && <button type="button" onClick={() => onRefresh('full')}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs dark:border-amber-700 dark:bg-slate-800">读取全文 PDF</button>}
                      </div>
                    </>}
                    {scope?.paperHasAbstract && preview.readingMode !== 'abstract' && <button type="button" onClick={() => onRefresh('abstract')}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs dark:border-amber-700 dark:bg-slate-800">改为读取摘要</button>}
                    {!scope?.pdfAttachmentCount && <p>请在 Zotero 检查是否选中了正确文献，为该条目添加 PDF 或补充摘要后重新读取。</p>}
                  </div>}
                  {hasAvailableContent && !hasSelectedContent && <p role="alert" className="mt-3 text-xs text-amber-700 dark:text-amber-300">请至少勾选一种已有内容的资料。</p>}
                </fieldset>
              )}

              {stage === 'ready' && !partialReading && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 font-semibold text-slate-900 dark:text-white">分析深度</legend>
                  {(['quick', 'deep'] as const).map((value) => (
                    <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="radio" name="ai-research-mode" value={value} checked={mode === value}
                        onChange={() => setMode(value)} className="mt-1" />
                      <span><strong>{value === 'quick' ? '快速概览' : '深入分析'}</strong>
                        <small className="mt-1 block text-slate-600 dark:text-slate-400">
                          {value === 'quick'
                            ? `${enabledSources.pdf ? (scope?.pdfCharacters || 0) > 20000 ? '跨区间选取 PDF 节选' : '使用本次已准备的 PDF' : '不纳入 PDF'}，并精简选中的笔记与批注；约 ${preview.quickCalls} 次模型请求。`
                            : enabledSources.pdf && preview.deepCalls > 1
                              ? `分段阅读已提取 PDF；整合时压缩候选、笔记和批注，约 ${preview.deepCalls} 次模型请求。`
                              : '依据现有资料完成单次综合分析，约 1 次模型请求。'}
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {stage === 'ready' && partialReading && <p aria-label="部分读取流程" className="rounded-lg bg-blue-50 p-3 text-xs leading-5 dark:bg-blue-950/40">
                所选部分采用单次分析，随后核对引文并保存；不再分段阅读或二次整合。只围绕这些章节已有的信息组织核心问题与结论。
              </p>}

              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-800">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={15} />数据与费用</div>
                <p className="mt-1">开始后将通过 llm-for-zotero 向 {selectedModel?.local ? '本机模型' : selectedModel?.host || preview.endpointHost}（{selectedModel?.model || preview.model}，推理强度：{modelSelection.reasoningLevel}）发送资料，
                  本次选中资料约 {selectedCharacters.toLocaleString()} 字符{!partialReading && mode === 'quick' ? '（快速模式还会进一步节选）' : ''}。调用记录由 llm-for-zotero 管理；实际 token、费用和耗时由模型服务决定。
                  仅有短引文与指定资料片段匹配的判断会标为“原文支持”，仍需回到原文核对。
                  PDF、笔记、批注划线和批注评论会分别编号；评论只作为读者材料。</p>
              </div>
            </>
          )}

          {stage === 'running' && (
            <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
              <Loader2 className="shrink-0 animate-spin text-blue-600" size={19} />
              <div><strong>{progress?.phase || '正在联系模型服务'}</strong>
                <div className="mt-1 text-xs">{progress ? `${progress.completed} / ${progress.total} 步完成` : '准备请求中'}。
                  取消会中止当前请求；已发送的请求可能由模型服务计费。</div>
              </div>
            </div>
          )}
          {stage === 'saving' && <div role="status" className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
            <Loader2 className="animate-spin text-blue-600" size={19} />正在把可编辑草稿保存到本机。保存完成后可在画布审阅，再归档至 Zotero。
          </div>}
          {stage === 'error' && <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle size={18} className="shrink-0" /><span>{error}</span>
          </div>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={onSettings} disabled={busy}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
              llm-for-zotero 设置
            </button>
            {preview && !busy && <button type="button" onClick={() => onRefresh(readingMode)}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              重新读取资料
            </button>}
          </div>
          <div className="flex gap-2">
            {stage === 'ready' && <button type="button" onClick={() => onStart(partialReading ? 'deep' : mode, enabledSources, modelSelection)} disabled={abstractEditor || !hasSelectedContent || !selectedModel?.available}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 size={16} />开始分析</button>}
            {stage === 'error' && <button type="button" onClick={() => onRetry(partialReading ? 'deep' : mode, enabledSources, modelSelection)} disabled={abstractEditor || (Boolean(preview) && (!hasSelectedContent || !selectedModel?.available))}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">重试</button>}
            {busy && stage !== 'saving' && <button type="button" onClick={onCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">取消</button>}
            {!busy && <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">关闭</button>}
          </div>
        </footer>
      </section>
    </div>
  );
};
