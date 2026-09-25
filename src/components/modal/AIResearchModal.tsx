import React, { useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { ResearchInputPreview, ResearchProgress } from '../../services/zotero/researchAnalysis';

export type AIResearchStage = 'preparing' | 'ready' | 'running' | 'saving' | 'error';

interface AIResearchModalProps {
  isOpen: boolean;
  stage: AIResearchStage;
  preview: ResearchInputPreview | null;
  progress: ResearchProgress | null;
  error: string;
  onStart: (mode: 'quick' | 'deep') => void;
  onRetry: (mode: 'quick' | 'deep') => void;
  onCancel: () => void;
  onClose: () => void;
  onSettings: () => void;
}

export const AIResearchModal: React.FC<AIResearchModalProps> = ({
  isOpen, stage, preview, progress, error, onStart, onRetry, onCancel, onClose, onSettings,
}) => {
  const [mode, setMode] = useState<'quick' | 'deep'>('deep');
  const scope = preview?.sourceScope;
  const busy = stage === 'preparing' || stage === 'running' || stage === 'saving';
  const dialogRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')?.focus();
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
          'button:not([disabled]), input:not([disabled])') || []);
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

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 text-sm text-slate-700 dark:text-slate-200">
          {stage === 'preparing' && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
              <Loader2 className="animate-spin text-blue-600" size={19} />
              <span>正在本机读取摘要、笔记、批注和可提取的 PDF 文字；此阶段不向模型发送论文资料。</span>
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
                  <span>摘要：{scope?.hasAbstract ? '已纳入' : '缺失'}</span>
                  <span>PDF：{scope?.pdfState}</span>
                  <span>笔记：{scope?.noteCount || 0} 条{scope?.omittedNotes ? `，另有 ${scope.omittedNotes} 条未纳入` : ''}</span>
                  <span>批注：{scope?.annotationCount || 0} 条{scope?.omittedAnnotations ? `，另有 ${scope.omittedAnnotations} 条未纳入` : ''}</span>
                  <span className="sm:col-span-2">归档：{preview.archiveState}</span>
                </div>
                {scope?.pdfTruncated && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  PDF 超出读取范围或已跨区间采样；导图会标注资料不完整。
                </p>}
              </div>

              {stage === 'ready' && (
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
                            ? `${(scope?.pdfCharacters || 0) > 20000 ? '跨区间选取 PDF 节选' : '使用本次已准备的 PDF'}，并精简笔记与批注；约 ${preview.quickCalls} 次模型请求。`
                            : preview.deepCalls > 1
                              ? `分段阅读已提取 PDF 并整合，约 ${preview.deepCalls} 次模型请求。`
                              : '依据现有资料完成单次综合分析，约 1 次模型请求。'}
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-800">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={15} />数据与费用</div>
                <p className="mt-1">开始后将向 {preview.localModel ? '本机模型' : preview.endpointHost}（{preview.model}）发送资料，
                  本次准备了约 {preview.estimatedCharacters.toLocaleString()} 字符。实际 token、费用和耗时由模型服务决定。
                  仅有短引文文本匹配的判断会标为“原文支持”，仍需回到原文核对。</p>
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
          <button type="button" onClick={onSettings} disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
            MindFlow 设置
          </button>
          <div className="flex gap-2">
            {stage === 'ready' && <button type="button" onClick={() => onStart(mode)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              <CheckCircle2 size={16} />开始分析</button>}
            {stage === 'error' && <button type="button" onClick={() => onRetry(mode)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">重试</button>}
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
