import React, { useState, useEffect, useRef } from 'react';
import { LayoutNode } from '../../core/model/types';
import {
  Search, Plus, CornerDownRight, Layout, Palette,
  ListTree, Download, Maximize2, HelpCircle, Inbox,
  FileText, ArrowRight, Settings
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: '操作指令' | '导图节点' | '视图切换';
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: LayoutNode[];
  onSelectAndCenterNode: (nodeId: string) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onToggleOutline: () => void;
  onToggleInbox: () => void;
  onToggleZen: () => void;
  onChangeLayout: (layout: 'mindmap' | 'logic-right' | 'org-down') => void;
  onChangeTheme: (themeId: string) => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportMarkdown: () => void;
  onExportPDF?: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  nodes,
  onSelectAndCenterNode,
  onAddChild,
  onAddSibling,
  onToggleOutline,
  onToggleInbox,
  onToggleZen,
  onChangeLayout,
  onChangeTheme,
  onExportPNG,
  onExportSVG,
  onExportMarkdown,
  onExportPDF,
  onOpenShortcuts,
  onOpenSettings,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Base system commands
  const defaultCommands: CommandItem[] = [
    {
      id: 'cmd_add_child',
      title: '插入子主题 (Add Child)',
      subtitle: '快捷键 Tab',
      category: '操作指令',
      icon: <Plus className="w-4 h-4 text-blue-500" />,
      action: onAddChild,
    },
    {
      id: 'cmd_add_sibling',
      title: '插入同级主题 (Add Sibling)',
      subtitle: '快捷键 Enter',
      category: '操作指令',
      icon: <CornerDownRight className="w-4 h-4 text-emerald-500" />,
      action: onAddSibling,
    },
    {
      id: 'cmd_inbox',
      title: '打开收集箱 (Inbox)',
      subtitle: '查看划词与灵感暂存',
      category: '视图切换',
      icon: <Inbox className="w-4 h-4 text-amber-500" />,
      action: onToggleInbox,
    },
    {
      id: 'cmd_zen',
      title: '切换禅模式 (Zen Focus)',
      subtitle: '隐藏工具栏，沉浸思考',
      category: '视图切换',
      icon: <Maximize2 className="w-4 h-4 text-purple-500" />,
      action: onToggleZen,
    },
    {
      id: 'cmd_outline',
      title: '切换大纲视图 (Outline View)',
      subtitle: '层级列表双向联动',
      category: '视图切换',
      icon: <ListTree className="w-4 h-4 text-sky-500" />,
      action: onToggleOutline,
    },
    {
      id: 'cmd_layout_mindmap',
      title: '切换为思维导图布局 (左右平衡)',
      category: '操作指令',
      icon: <Layout className="w-4 h-4 text-indigo-500" />,
      action: () => onChangeLayout('mindmap'),
    },
    {
      id: 'cmd_layout_logic',
      title: '切换为逻辑图布局 (单向向右)',
      category: '操作指令',
      icon: <Layout className="w-4 h-4 text-indigo-500" />,
      action: () => onChangeLayout('logic-right'),
    },
    {
      id: 'cmd_layout_org',
      title: '切换为组织架构图 (自顶向下)',
      category: '操作指令',
      icon: <Layout className="w-4 h-4 text-indigo-500" />,
      action: () => onChangeLayout('org-down'),
    },
    {
      id: 'cmd_theme_classic',
      title: '主题: 经典商务蓝',
      category: '操作指令',
      icon: <Palette className="w-4 h-4 text-blue-600" />,
      action: () => onChangeTheme('classic-blue'),
    },
    {
      id: 'cmd_theme_dark',
      title: '主题: 极夜星云 (深色模式)',
      category: '操作指令',
      icon: <Palette className="w-4 h-4 text-purple-400" />,
      action: () => onChangeTheme('dark-nebula'),
    },
    {
      id: 'cmd_theme_macaron',
      title: '主题: 马卡龙缤纷',
      category: '操作指令',
      icon: <Palette className="w-4 h-4 text-pink-500" />,
      action: () => onChangeTheme('macaron'),
    },
    {
      id: 'cmd_export_png',
      title: '导出为高清图片 (PNG)',
      category: '操作指令',
      icon: <Download className="w-4 h-4 text-teal-500" />,
      action: onExportPNG,
    },
    {
      id: 'cmd_export_svg',
      title: '导出为矢量图形 (SVG)',
      category: '操作指令',
      icon: <Download className="w-4 h-4 text-teal-500" />,
      action: onExportSVG,
    },
    {
      id: 'cmd_export_md',
      title: '导出为 Markdown 大纲',
      category: '操作指令',
      icon: <Download className="w-4 h-4 text-teal-500" />,
      action: onExportMarkdown,
    },
    ...(onExportPDF ? [{
      id: 'cmd_export_pdf',
      title: '导出为矢量 PDF 文档 (Print to PDF)',
      category: '操作指令' as const,
      icon: <Download className="w-4 h-4 text-rose-500" />,
      action: onExportPDF,
    }] : []),
    {
      id: 'cmd_shortcuts',
      title: '查看全部快捷键指南',
      category: '视图切换',
      icon: <HelpCircle className="w-4 h-4 text-slate-500" />,
      action: onOpenShortcuts,
    },
    {
      id: 'cmd_settings',
      title: '系统设置与偏好 (Settings)',
      subtitle: '自定义工具栏、数据备份、WebDAV 云同步与偏好 (Ctrl+,)',
      category: '操作指令',
      icon: <Settings className="w-4 h-4 text-blue-500" />,
      action: () => {
        if (onOpenSettings) onOpenSettings();
      },
    },
  ];

  // Node search items
  const nodeMatches: CommandItem[] = query.trim().length > 0
    ? nodes
        .filter(n =>
          n.node.text.toLowerCase().includes(query.toLowerCase()) ||
          n.node.note?.toLowerCase().includes(query.toLowerCase()) ||
          n.node.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 8)
        .map(n => ({
          id: 'node_' + n.id,
          title: n.node.text,
          subtitle: n.node.note ? `备注: ${n.node.note}` : (n.parent ? `上级: ${n.parent.node.text}` : '中心主题'),
          category: '导图节点',
          icon: <FileText className="w-4 h-4 text-blue-500" />,
          action: () => onSelectAndCenterNode(n.id),
        }))
    : [];

  const filteredCommands = query.trim().length === 0
    ? defaultCommands
    : defaultCommands.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.subtitle?.toLowerCase().includes(query.toLowerCase())
      );

  const allItems = [...nodeMatches, ...filteredCommands];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(allItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(allItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索导图节点、执行操作命令或切换主题... (↑ ↓ 导航, Enter 确定)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              未找到与「{query}」匹配的节点或命令
            </div>
          ) : (
            allItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                  idx === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-slate-400">
                  <span className="text-[10px] uppercase font-semibold tracking-wider">
                    {item.category}
                  </span>
                  {idx === selectedIndex && (
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
