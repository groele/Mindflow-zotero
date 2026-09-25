import React, { useEffect, useState } from 'react';
import {
  Sparkles, Plus, BookOpen, LayoutTemplate, Upload,
  Clock, ArrowRight, X
} from 'lucide-react';
import { DocumentSummary, StorageService } from '../../services/storage/storageService';

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

  useEffect(() => {
    if (!isOpen) return;
    StorageService.getDocumentList()
      .then((list) => {
        // Filter out legacy default doc and take top 4
        const filtered = list.filter((item) => item.id !== 'doc_welcome_default');
        setRecentDocs(filtered.slice(0, 4));
      })
      .catch(() => setRecentDocs([]));
  }, [isOpen]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden select-none flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-linear-to-r from-blue-50/50 via-white to-indigo-50/30 dark:from-slate-800/40 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>欢迎使用 MindFlow 思维导图</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {isZoteroMode ? 'Zotero 7 伴读版' : '工作台'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                为学术研究、文献梳理与系统思考而生的思维画布
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="关闭 (Esc)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
          {/* Quick-Action Grid */}
          <div>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              开始创作
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Blank Map */}
              <button
                onClick={() => {
                  onClose();
                  onCreateBlank();
                }}
                className="group relative p-4 rounded-xl border-2 border-blue-500/20 hover:border-blue-500 dark:border-blue-500/30 dark:hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-left transition-all duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                      推荐
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    新建空白导图
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    从中心主题开始自由发散，聚焦当下灵感与创作
                  </p>
                </div>
                <div className="mt-3 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  <span>立即开启空白画布</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>

              {/* 2. Zotero Selection */}
              <button
                onClick={() => {
                  onClose();
                  onImportZotero();
                }}
                className="group relative p-4 rounded-xl border border-slate-200 hover:border-indigo-500 dark:border-slate-800 dark:hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/40 dark:bg-slate-800/30 dark:hover:bg-indigo-950/20 text-left transition-all duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-md">
                      文献协同
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    从选中文献成图
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    一键提取 Zotero 选中的论文题录、摘要与笔记
                  </p>
                </div>
                <div className="mt-3 flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>生成文献脉络</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>

              {/* 3. Templates */}
              <button
                onClick={() => {
                  onClose();
                  onOpenTemplates();
                }}
                className="group relative p-4 rounded-xl border border-slate-200 hover:border-emerald-500 dark:border-slate-800 dark:hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/40 dark:bg-slate-800/30 dark:hover:bg-emerald-950/20 text-left transition-all duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <LayoutTemplate className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md">
                      模板库
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    精选学术与思维模板
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    文献综述、SWOT 模型、开题规划、读书笔记等
                  </p>
                </div>
                <div className="mt-3 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>选择模板</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>

              {/* 4. Import File */}
              <button
                onClick={() => {
                  onClose();
                  onTriggerImportFile();
                }}
                className="group relative p-4 rounded-xl border border-slate-200 hover:border-amber-500 dark:border-slate-800 dark:hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/40 dark:bg-slate-800/30 dark:hover:bg-amber-950/20 text-left transition-all duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                      导入
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    导入外部文件
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    支持 Markdown (.md)、JSON 工程文件或 OPML
                  </p>
                </div>
                <div className="mt-3 flex items-center text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                  <span>浏览本地文件</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            </div>
          </div>

          {/* Recent Maps / Tips */}
          {recentDocs.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>最近编辑导图</span>
                <span className="text-[11px] font-normal text-slate-400">点击直接打开</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentDocs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onClose();
                      onOpenDocument(item.id);
                    }}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-slate-800/40 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(item.updatedAt)}</span>
                        <span>·</span>
                        <span>{item.nodeCount} 节点</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/80 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-base">💡</span>
              <div>
                快捷提示：按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-mono text-[10px]">Tab</kbd> 添加子主题，
                按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-mono text-[10px]">Enter</kbd> 添加同级主题，
                按 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-mono text-[10px]">Space</kbd> 或双击编辑文字。
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(e) => onToggleShowOnStartup(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>启动时显示此欢迎页面</span>
          </label>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            直接进入画布
          </button>
        </div>
      </div>
    </div>
  );
};
