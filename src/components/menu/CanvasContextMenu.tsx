import React, { useEffect, useRef, useMemo } from 'react';
import {
  Focus, RotateCcw, Plus,
  Grid, CircleDot, Square, Moon, Sun,
  Maximize2, ClipboardPaste
} from 'lucide-react';

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCenterCanvas: () => void;
  onResetZoom: () => void;
  onFitView?: () => void;
  onAddRootChild?: () => void;
  onPasteSubtree?: () => void;
  hasClipboardContent?: boolean;
  canvasBackground: 'dots' | 'grid' | 'blank';
  onChangeCanvasBackground: (bg: 'dots' | 'grid' | 'blank') => void;
  onToggleTheme?: () => void;
  isDark?: boolean;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  onClose,
  onCenterCanvas,
  onResetZoom,
  onFitView,
  onAddRootChild,
  onPasteSubtree,
  hasClipboardContent = false,
  canvasBackground,
  onChangeCanvasBackground,
  onToggleTheme,
  isDark = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    const handleClickOutside = (e: MouseEvent) => {
      if (e.button === 2) return;
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    timerId = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }, 16);

    return () => {
      clearTimeout(timerId);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay inside viewport
  const adjustedStyle = useMemo(() => {
    const menuWidth = 210;
    const menuHeight = 290;
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

  return (
    <div
      ref={menuRef}
      style={adjustedStyle}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-[100] w-52 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 truncate mb-1">
        画布导航与视图
      </div>

      <button
        onClick={() => {
          onCenterCanvas();
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Focus className="w-3.5 h-3.5 text-indigo-500" />
          <span>居中对齐全部主题</span>
        </div>
        <kbd className="text-[10px] font-mono text-slate-400">Space</kbd>
      </button>

      <button
        onClick={() => {
          onResetZoom();
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
          <span>100% 原始缩放</span>
        </div>
        <kbd className="text-[10px] font-mono text-slate-400">Ctrl+0</kbd>
      </button>

      {onFitView && (
        <button
          onClick={() => {
            onFitView();
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Maximize2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>自适应全图视野</span>
          </div>
        </button>
      )}

      {onAddRootChild && (
        <button
          onClick={() => {
            onAddRootChild();
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
            <span>添加中心分支</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400">Tab</kbd>
        </button>
      )}

      {onPasteSubtree && hasClipboardContent && (
        <button
          onClick={() => {
            onPasteSubtree();
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-600 dark:text-purple-400 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-3.5 h-3.5 text-purple-500" />
            <span>粘贴分支到中心</span>
          </div>
          <kbd className="text-[10px] font-mono text-purple-400">Ctrl+V</kbd>
        </button>
      )}

      <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />
      <div className="px-3 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        画布背景样式
      </div>

      <div className="px-2 py-1 flex items-center justify-between gap-1">
        <button
          onClick={() => {
            onChangeCanvasBackground('dots');
            onClose();
          }}
          className={`flex-1 flex flex-col items-center py-1 rounded transition-colors text-[10px] ${
            canvasBackground === 'dots'
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <CircleDot className="w-3.5 h-3.5 mb-0.5" />
          点阵
        </button>
        <button
          onClick={() => {
            onChangeCanvasBackground('grid');
            onClose();
          }}
          className={`flex-1 flex flex-col items-center py-1 rounded transition-colors text-[10px] ${
            canvasBackground === 'grid'
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <Grid className="w-3.5 h-3.5 mb-0.5" />
          网格
        </button>
        <button
          onClick={() => {
            onChangeCanvasBackground('blank');
            onClose();
          }}
          className={`flex-1 flex flex-col items-center py-1 rounded transition-colors text-[10px] ${
            canvasBackground === 'blank'
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <Square className="w-3.5 h-3.5 mb-0.5" />
          空白
        </button>
      </div>

      {onToggleTheme && (
        <>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />
          <button
            onClick={() => {
              onToggleTheme();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              )}
              <span>{isDark ? '切换浅色模式' : '切换深色模式'}</span>
            </div>
          </button>
        </>
      )}
    </div>
  );
};
