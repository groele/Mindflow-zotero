import React, { useState, useRef } from 'react';
import {
  Plus, CornerDownRight, Trash2, Undo2, Redo2,
  Palette, Layout, ListTree, Download, Upload,
  HelpCircle, Maximize2, ZoomIn, ZoomOut,
  Globe, ChevronDown, Check, Inbox, Sparkles, Command, Settings,
  Presentation, Search as SearchIcon, Scan
} from 'lucide-react';
import { LayoutType, ThemeColors } from '../../core/model/types';
import { THEMES } from '../../core/theme/themes';
import { ToolbarButtonsConfig } from '../../core/model/settingsTypes';

interface ToolbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDeleteNode: () => void;
  hasSelection: boolean;
  currentLayout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  currentThemeId: string;
  onThemeChange: (themeId: string) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitScreen?: () => void;
  isOutlineOpen: boolean;
  onToggleOutline: () => void;
  isInboxOpen?: boolean;
  onToggleInbox?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSearch?: () => void;
  onStartPresentation?: () => void;
  onOpenTemplates?: () => void;
  onToggleZen?: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings?: () => void;
  isPro?: boolean;
  toolbarButtons?: ToolbarButtonsConfig;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  onExportOPML?: () => void;
  onExportHTML?: () => void;
  onImportFile: (file: File) => void;
  onCaptureCurrentTab?: () => void;
  isSidepanelMode?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  hasSelection,
  currentLayout,
  onLayoutChange,
  currentThemeId,
  onThemeChange,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitScreen,
  isOutlineOpen,
  onToggleOutline,
  isInboxOpen,
  onToggleInbox,
  onOpenCommandPalette,
  onOpenSearch,
  onStartPresentation,
  onOpenTemplates,
  onToggleZen,
  onOpenShortcuts,
  onOpenSettings,
  isPro: _isPro = false,
  toolbarButtons,
  onExportPNG,
  onExportSVG,
  onExportMarkdown,
  onExportJSON,
  onExportOPML,
  onExportHTML,
  onImportFile,
  onCaptureCurrentTab,
  isSidepanelMode,
}) => {
  const buttons = toolbarButtons || {
    history: true,
    insert: true,
    layout: true,
    theme: true,
    outline: true,
    inbox: true,
    templates: true,
    zen: true,
    export: true,
    zoom: true,
  };

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    e.target.value = '';
  };

  return (
    <header className="h-14 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 z-30 select-none">
      {/* Left: App Logo & Document Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <span className="text-base tracking-tighter">M</span>
          </div>
          {!isSidepanelMode && (
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm hidden sm:inline">
              MindFlow
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Editable Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 px-2 py-1 rounded-md border border-transparent focus:border-blue-400 outline-none transition-colors truncate max-w-[140px] sm:max-w-[240px]"
          title="点击修改思维导图标题"
        />
      </div>

      {/* Center: Core Action Buttons */}
      {(buttons.history || buttons.insert) && (
        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          {/* Undo / Redo */}
          {buttons.history && (
            <>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="撤销 (Ctrl+Z)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="重做 (Ctrl+Y)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </>
          )}

          {buttons.history && buttons.insert && (
            <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
          )}

          {/* Insert Child */}
          {buttons.insert && (
            <>
              <button
                onClick={onAddChild}
                title="插入子主题 (Tab)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">子主题</span>
                <kbd className="hidden lg:inline text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1 rounded">Tab</kbd>
              </button>

              {/* Insert Sibling */}
              <button
                onClick={onAddSibling}
                title="插入同级主题 (Enter)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">同级主题</span>
                <kbd className="hidden lg:inline text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1 rounded">Enter</kbd>
              </button>
            </>
          )}

          {/* Delete */}
          <button
            onClick={onDeleteNode}
            disabled={!hasSelection}
            title="删除主题 (Delete)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right: Layout, Theme, Outline, Export, Zoom & Extensions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Capture webpage card button (Chrome extension feature) */}
        {onCaptureCurrentTab && (
          <button
            onClick={onCaptureCurrentTab}
            title="一键收录当前网页信息至导图"
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">收录网页</span>
          </button>
        )}

        {/* Layout dropdown */}
        {buttons.layout && (
          <div className="relative">
            <button
              onClick={() => {
                setIsLayoutMenuOpen(!isLayoutMenuOpen);
                setIsThemeMenuOpen(false);
                setIsExportMenuOpen(false);
              }}
              title="切换导图布局结构"
              className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Layout className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">
                {currentLayout === 'mindmap' ? '思维导图' : currentLayout === 'logic-right' ? '逻辑图' : '组织架构'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isLayoutMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => { onLayoutChange('mindmap'); setIsLayoutMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 ${currentLayout === 'mindmap' ? 'text-blue-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>思维导图 (左右)</span>
                  {currentLayout === 'mindmap' && <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => { onLayoutChange('logic-right'); setIsLayoutMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 ${currentLayout === 'logic-right' ? 'text-blue-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>逻辑图 (单向右)</span>
                  {currentLayout === 'logic-right' && <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => { onLayoutChange('org-down'); setIsLayoutMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 ${currentLayout === 'org-down' ? 'text-blue-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>组织架构 (向下)</span>
                  {currentLayout === 'org-down' && <Check className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Theme dropdown */}
        {buttons.theme && (
          <div className="relative">
            <button
              onClick={() => {
                setIsThemeMenuOpen(!isThemeMenuOpen);
                setIsLayoutMenuOpen(false);
                setIsExportMenuOpen(false);
              }}
              title="选择设计主题"
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Palette className="w-4 h-4 text-slate-500" />
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 max-h-80 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  选择设计主题
                </div>
                {Object.values(THEMES).map((thm: ThemeColors) => (
                  <button
                    key={thm.id}
                    onClick={() => { onThemeChange(thm.id); setIsThemeMenuOpen(false); }}
                    className="w-full px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: thm.rootBg }} />
                      <span>{thm.name}</span>
                    </div>
                    {currentThemeId === thm.id && <Check className="w-3 h-3 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Command Palette button */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            title="全局命令面板与搜索 (Ctrl+K)"
            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            <Command className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden xl:inline text-[11px]">命令</span>
            <kbd className="hidden lg:inline text-[10px] text-slate-400 bg-white dark:bg-slate-700 px-1 rounded border border-slate-200 dark:border-slate-600">⌘K</kbd>
          </button>
        )}

        {/* Inbox button */}
        {buttons.inbox && onToggleInbox && (
          <button
            onClick={onToggleInbox}
            title="灵感与网页收集箱 (Inbox)"
            className={`p-1.5 rounded-lg transition-colors ${
              isInboxOpen
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
          </button>
        )}

        {/* Templates button */}
        {buttons.templates && onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            title="模版库 (SWOT/读书笔记/敏捷规划)"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
          </button>
        )}

        {/* Outline view toggle */}
        {buttons.outline && (
          <button
            onClick={onToggleOutline}
            title="切换大纲模式"
            className={`p-1.5 rounded-lg transition-colors ${isOutlineOpen ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <ListTree className="w-4 h-4" />
          </button>
        )}

        {/* Zen Mode toggle */}
        {buttons.zen && onToggleZen && (
          <button
            onClick={onToggleZen}
            title="开启禅模式 (Zen Focus Mode)"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-4 h-4 text-purple-600" />
          </button>
        )}

        {/* In-canvas Search */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            title="在导图中搜索 (Ctrl+F)"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <SearchIcon className="w-4 h-4 text-sky-500" />
          </button>
        )}

        {/* Presentation Mode */}
        {onStartPresentation && (
          <button
            onClick={onStartPresentation}
            title="全屏路演/演示模式 (Presentation Mode)"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors"
          >
            <Presentation className="w-4 h-4" />
          </button>
        )}

        {/* Export / Import dropdown */}
        {buttons.export && (
          <div className="relative">
            <button
              onClick={() => {
                setIsExportMenuOpen(!isExportMenuOpen);
                setIsThemeMenuOpen(false);
                setIsLayoutMenuOpen(false);
              }}
              title="导入与导出"
              className="flex items-center gap-1 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  导出格式
                </div>
                <button
                  onClick={() => { onExportPNG(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  🖼️ 高清图片 (PNG)
                </button>
                <button
                  onClick={() => { onExportSVG(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  📐 矢量图形 (SVG)
                </button>
                <button
                  onClick={() => { onExportMarkdown(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  📝 Markdown 大纲 (.md)
                </button>
                <button
                  onClick={() => { onExportJSON(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  💾 JSON 工程备份
                </button>
                <button
                  onClick={() => { onExportOPML?.(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  📑 OPML 2.0 大纲 (.opml)
                </button>
                <button
                  onClick={() => { onExportHTML?.(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  🌐 独立离线交互网页 (.html)
                </button>

                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  导入
                </div>
                <button
                  onClick={() => { fileInputRef.current?.click(); setIsExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>导入 Markdown / JSON / OPML</span>
                </button>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.markdown,.opml"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Shortcuts Cheat Sheet */}
        <button
          onClick={onOpenShortcuts}
          title="快捷键大全 (?)"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-slate-500" />
        </button>

        {/* Settings button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="系统设置与偏好 (Ctrl+,)"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-500" />
          </button>
        )}

        {/* Zoom & Fit controls */}
        {buttons.zoom && (
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {onFitScreen && (
              <button
                onClick={onFitScreen}
                title="自适应全屏居中 (Ctrl+1)"
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
              >
                <Scan className="w-3.5 h-3.5 text-blue-500" />
              </button>
            )}
            <button
              onClick={onZoomOut}
              title="缩小画布"
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetZoom}
              title="重置为 100% 原始大小 (Ctrl+0)"
              className="px-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              title="放大画布"
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Open in full tab button if in sidepanel or popup */}
        {isSidepanelMode && (
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
                chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
              } else {
                window.open('index.html', '_blank');
              }
            }}
            title="在独立大标签页中全屏打开"
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
