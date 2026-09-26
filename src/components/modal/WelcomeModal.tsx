import React, { useEffect, useState } from 'react';
import {
  Sparkles, Plus, BookOpen, LayoutTemplate, Upload,
  Clock, ArrowRight, X, Lightbulb
} from 'lucide-react';
import { DocumentSummary, StorageService } from '../../services/storage/storageService';
import { getSelectedZoteroItems, ZoteroItemData } from '../../services/zotero/zoteroBridge';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onImportZotero: () => void;
  onOpenTemplates: () => void;
  onTriggerImportFile: () => void;
  onOpenDocument: (docId: string) => void;
  showOnStartup: boolean;
  onToggleShowOnStartup: (show: boolean) => void;
  isZoteroMode: boolean;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onCreateBlank,
  onImportZotero,
  onOpenTemplates,
  onTriggerImportFile,
  onOpenDocument,
  showOnStartup,
  onToggleShowOnStartup,
  isZoteroMode,
}) => {
  const [recentDocs, setRecentDocs] = useState<DocumentSummary[]>([]);
  const [selectedZoteroItems, setSelectedZoteroItems] = useState<ZoteroItemData[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const items = getSelectedZoteroItems();
      setSelectedZoteroItems(items);
    } catch (_) {
      setSelectedZoteroItems([]);
    }
    StorageService.getDocumentList()
      .then((list) => {
        // Filter out legacy default doc and take top 4
        const filtered = list.filter((item) => item.id !== 'doc_welcome_default');
        setRecentDocs(filtered.slice(0, 4));
      })
      .catch(() => setRecentDocs([]));
  }, [isOpen, isZoteroMode]);

  if (!isOpen) return null;

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 animate-in fade-in duration-150 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mindflow-welcome-title"
        className="mindflow-welcome-modal bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-700 w-full max-w-[760px] min-w-0 overflow-hidden flex flex-col max-h-[min(92vh,760px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-7 py-5 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mindflow-welcome-brand w-11 h-11 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="mindflow-welcome-title" className="text-lg sm:text-xl leading-snug font-bold text-slate-950 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>欢迎使用 MindFlow 思维导图</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                  {isZoteroMode ? 'Zotero 10 伴读版' : '工作台'}
                </span>
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-1">
                整理文献、梳理研究思路，或从空白导图开始。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="关闭 (Esc)"
            aria-label="关闭欢迎页面"
            className="shrink-0 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 sm:px-7 py-5 overflow-y-auto flex-1 min-h-0 space-y-6">
          {/* Quick-Action Grid */}
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">
              开始创作
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Blank Map */}
              <button
                onClick={() => {
                  onClose();
                  onCreateBlank();
                }}
                className="mindflow-welcome-action group min-h-[166px] p-4 sm:p-[18px] rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/45 dark:bg-blue-950/25 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="mindflow-welcome-action-icon w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Plus className="w-[18px] h-[18px]" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                      推荐
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base leading-snug">
                    新建空白导图
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mt-1.5">
                    从中心主题开始，自由梳理研究思路。
                  </p>
                </div>
                <div className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200">
                  <span>新建空白导图</span>
                  <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </div>
              </button>

              {/* 2. Zotero Selection */}
              <button
                disabled={selectedZoteroItems.length !== 1}
                onClick={() => {
                  onClose();
                  onImportZotero();
                }}
                className={`mindflow-welcome-action group min-h-[166px] p-4 sm:p-[18px] rounded-xl border flex flex-col justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors ${
                  selectedZoteroItems.length === 1
                    ? 'border-blue-300 hover:border-blue-500 bg-blue-50/45 hover:bg-blue-50 dark:border-blue-700 dark:hover:border-blue-400 dark:bg-blue-950/25'
                    : 'border-slate-300 hover:border-blue-500 dark:border-slate-600 dark:hover:border-blue-400 bg-white dark:bg-slate-800/55'
                } ${selectedZoteroItems.length === 1 ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <BookOpen className="w-[18px] h-[18px]" aria-hidden="true" />
                    </div>
                    {selectedZoteroItems.length > 0 ? (
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true"></span>
                        已选 {selectedZoteroItems.length} 篇文献
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                        文献协同
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base leading-snug">
                    从所选论文生成研究导图
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mt-1.5 break-words">
                    {selectedZoteroItems.length > 0
                      ? selectedZoteroItems.length === 1
                        ? `已就绪：【${selectedZoteroItems[0].title}】将读取可用 PDF、摘要、笔记与批注`
                        : `当前选中 ${selectedZoteroItems.length} 篇；请只保留一篇论文以生成专属研究导图`
                      : '请先在 Zotero 中选中一篇论文或 PDF 附件，再打开此页面。'}
                  </p>
                </div>
                <div className={`flex items-center text-sm font-semibold ${selectedZoteroItems.length === 1 ? 'text-blue-800 dark:text-blue-200' : 'text-slate-600 dark:text-slate-300'}`}>
                  <span>{selectedZoteroItems.length === 1 ? '分析所选论文' : '选中文献后可使用'}</span>
                  {selectedZoteroItems.length === 1 && <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />}
                </div>
              </button>

              {/* 3. Templates */}
              <button
                onClick={() => {
                  onClose();
                  onOpenTemplates();
                }}
                className="mindflow-welcome-action group min-h-[166px] p-4 sm:p-[18px] rounded-xl border border-slate-300 hover:border-blue-500 dark:border-slate-600 dark:hover:border-blue-400 bg-white dark:bg-slate-800/55 text-left flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <LayoutTemplate className="w-[18px] h-[18px]" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                      模板库
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base leading-snug">
                    精选学术与思维模板
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mt-1.5">
                    文献综述、开题规划、读书笔记等常用结构。
                  </p>
                </div>
                <div className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200">
                  <span>选择模板</span>
                  <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </div>
              </button>

              {/* 4. Import File */}
              <button
                onClick={() => {
                  onClose();
                  onTriggerImportFile();
                }}
                className="mindflow-welcome-action group min-h-[166px] p-4 sm:p-[18px] rounded-xl border border-slate-300 hover:border-blue-500 dark:border-slate-600 dark:hover:border-blue-400 bg-white dark:bg-slate-800/55 text-left flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Upload className="w-[18px] h-[18px]" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                      导入
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base leading-snug">
                    导入外部文件
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mt-1.5">
                    支持 MindFlow 附件 (.mindflow)、JSON、Markdown 或 OPML
                  </p>
                </div>
                <div className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200">
                  <span>浏览本地文件</span>
                  <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </div>
              </button>
            </div>
          </div>

          {/* Recent Maps / Tips */}
          {recentDocs.length > 0 ? (
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center justify-between gap-3">
                <span>最近编辑导图</span>
                <span className="text-xs font-normal text-slate-600 dark:text-slate-300">点击打开</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recentDocs.map((item) => (
                  <button
                    key={item.id}
                    title={item.title}
                    onClick={() => {
                      onClose();
                      onOpenDocument(item.id);
                    }}
                    className="p-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-slate-800/55 text-left transition-colors flex items-center justify-between group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-sm font-semibold leading-snug text-slate-900 dark:text-white line-clamp-2">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{formatRelativeTime(item.updatedAt)}</span>
                        <span>·</span>
                        <span>{item.nodeCount} 节点</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-300 group-hover:text-blue-700 transition-colors shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/55 border border-slate-300 dark:border-slate-600 flex items-start gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                快捷提示：按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-800 dark:text-white font-mono text-xs">Tab</kbd> 添加子主题，
                按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-800 dark:text-white font-mono text-xs">Enter</kbd> 添加同级主题，
                按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-800 dark:text-white font-mono text-xs">Space</kbd> 或双击编辑文字。
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(e) => onToggleShowOnStartup(e.target.checked)}
              className="rounded border-slate-400 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 w-4 h-4"
            />
            <span>启动时显示此欢迎页面</span>
          </label>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-800 dark:text-white hover:text-blue-800 dark:hover:text-blue-200 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            直接进入画布
          </button>
        </div>
      </div>
    </div>
  );
};
