import React, { useEffect, useRef } from 'react';
import {
  CornerDownRight, Plus, Trash2, CheckSquare,
  Copy, FolderPlus, FolderMinus, Eye, FileText
} from 'lucide-react';
import { MindMapNode } from '../../core/model/types';

export interface ContextMenuProps {
  x: number;
  y: number;
  node: MindMapNode;
  onClose: () => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleTask: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onStartEdit: (id: string) => void;
  onFocusSubtree?: (id: string) => void;
  onCopyNode?: (id: string) => void;
  onDuplicateNode?: (id: string) => void;
  onPasteSubtree?: (id: string) => void;
  hasClipboardContent?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onAddChild,
  onAddSibling,
  onDelete,
  onToggleTask,
  onToggleCollapse,
  onStartEdit,
  onFocusSubtree,
  onCopyNode,
  onDuplicateNode,
  onPasteSubtree,
  hasClipboardContent = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay inside viewport
  const adjustedStyle = React.useMemo(() => {
    const menuWidth = 200;
    const menuHeight = 280;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + menuWidth > screenW) {
      posX = Math.max(10, screenW - menuWidth - 10);
    }
    if (posY + menuHeight > screenH) {
      posY = Math.max(10, screenH - menuHeight - 10);
    }

    return {
      left: `${posX}px`,
      top: `${posY}px`,
    };
  }, [x, y]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(node.text);
    } catch (e) {
      console.warn('Failed to copy text:', e);
    }
    onClose();
  };

  const isCollapsed = node.isExpanded === false;

  return (
    <div
      ref={menuRef}
      style={adjustedStyle}
      className="fixed z-50 w-52 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 truncate mb-1">
        {node.text}
      </div>

      <button
        onClick={() => {
          onAddChild(node.id);
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
          <span>插入子主题</span>
        </div>
        <kbd className="text-[10px] font-mono text-slate-400">Tab</kbd>
      </button>

      <button
        onClick={() => {
          onAddSibling(node.id);
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>插入同级主题</span>
        </div>
        <kbd className="text-[10px] font-mono text-slate-400">Enter</kbd>
      </button>

      <button
        onClick={() => {
          onStartEdit(node.id);
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>编辑文本</span>
        </div>
        <kbd className="text-[10px] font-mono text-slate-400">Space</kbd>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

      <button
        onClick={() => {
          onToggleTask(node.id);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
        <span>{node.task?.status ? '取消任务标记' : '设为待办任务 (Task)'}</span>
      </button>

      {node.children && node.children.length > 0 && (
        <button
          onClick={() => {
            onToggleCollapse(node.id);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <FolderMinus className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{isCollapsed ? '展开所有子分支' : '折叠此分支'}</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400">/</kbd>
        </button>
      )}

      {onFocusSubtree && (
        <button
          onClick={() => {
            onFocusSubtree(node.id);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <Eye className="w-3.5 h-3.5 text-purple-500" />
          <span>聚焦此分支 (下钻专注)</span>
        </button>
      )}

      {onCopyNode && (
        <button
          onClick={() => {
            onCopyNode(node.id);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-blue-500" />
            <span>复制分支节点</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+C</kbd>
        </button>
      )}

      {onDuplicateNode && (
        <button
          onClick={() => {
            onDuplicateNode(node.id);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-emerald-500" />
            <span>创建副本</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+D</kbd>
        </button>
      )}

      {onPasteSubtree && hasClipboardContent && (
        <button
          onClick={() => {
            onPasteSubtree(node.id);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-purple-500" />
            <span>粘贴子分支</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+V</kbd>
        </button>
      )}

      <button
        onClick={handleCopyText}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-slate-500" />
          <span>复制主题纯文本</span>
        </div>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

      <button
        onClick={() => {
          onDelete(node.id);
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" />
          <span>删除主题分支</span>
        </div>
        <kbd className="text-[10px] font-mono text-red-400">Del</kbd>
      </button>
    </div>
  );
};
