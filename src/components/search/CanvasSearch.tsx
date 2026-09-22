import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X, Repeat, Check } from 'lucide-react';
import { MindMapNode } from '../../core/model/types';

interface CanvasSearchProps {
  isOpen: boolean;
  onClose: () => void;
  rootNode: MindMapNode;
  onJumpToNode: (nodeId: string) => void;
  onHighlightMatches: (matchedIds: string[]) => void;
  onReplaceCurrent?: (nodeId: string, fromText: string, toText: string) => void;
  onReplaceAll?: (fromText: string, toText: string) => void;
}

export const CanvasSearch: React.FC<CanvasSearchProps> = ({
  isOpen,
  onClose,
  rootNode,
  onJumpToNode,
  onHighlightMatches,
  onReplaceCurrent,
  onReplaceAll,
}) => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [replaceNotice, setReplaceNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setReplaceText('');
      setMatches([]);
      setCurrentIndex(0);
      setShowReplace(false);
      setReplaceNotice(null);
      onHighlightMatches([]);
    }
  }, [isOpen]);

  // Search through all nodes
  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      setCurrentIndex(0);
      onHighlightMatches([]);
      return;
    }

    const q = query.toLowerCase();
    const found: string[] = [];

    const traverse = (node: MindMapNode) => {
      const matchText = node.text.toLowerCase().includes(q);
      const matchNote = node.note?.toLowerCase().includes(q);
      const matchTag = node.tags?.some((t) => t.toLowerCase().includes(q));

      if (matchText || matchNote || matchTag) {
        found.push(node.id);
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(rootNode);
    setMatches(found);
    setCurrentIndex(0);
    onHighlightMatches(found);

    if (found.length > 0) {
      onJumpToNode(found[0]);
    }
  }, [query, rootNode]);

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIdx);
    onJumpToNode(matches[nextIdx]);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIdx);
    onJumpToNode(matches[prevIdx]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      setShowReplace(!showReplace);
    }
  };

  const handleReplaceCurrent = () => {
    if (matches.length === 0 || !query.trim()) return;
    const currentId = matches[currentIndex];
    onReplaceCurrent?.(currentId, query, replaceText);
    setReplaceNotice('已替换当前项');
    setTimeout(() => setReplaceNotice(null), 2000);
  };

  const handleReplaceAll = () => {
    if (!query.trim() || matches.length === 0) return;
    onReplaceAll?.(query, replaceText);
    setReplaceNotice(`已完成全部替换 (${matches.length} 处)`);
    setTimeout(() => setReplaceNotice(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-6 z-40 flex flex-col gap-1.5 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Search Input Row */}
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="在导图中搜索 (Enter 下一个, Ctrl+H 替换)..."
          className="w-48 sm:w-64 text-xs text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400"
        />

        {query && (
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 px-1">
            {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '无匹配'}
          </span>
        )}

        <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 dark:border-slate-700 pl-1 text-slate-500">
          <button
            type="button"
            onClick={handlePrev}
            disabled={matches.length === 0}
            title="上一个 (Shift+Enter)"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={matches.length === 0}
            title="下一个 (Enter)"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowReplace(!showReplace)}
            title="切换查找与替换 (Ctrl+H)"
            className={`p-1 rounded transition-colors ${showReplace ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="关闭 (Esc)"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Replace Drawer */}
      {showReplace && (
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <Repeat className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="替换为新文本..."
            className="flex-1 text-xs text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleReplaceCurrent}
              disabled={matches.length === 0 || !query.trim()}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-[11px] font-medium rounded-md transition-colors"
            >
              替换
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={matches.length === 0 || !query.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-medium rounded-md shadow-xs transition-colors"
            >
              全部替换
            </button>
          </div>
        </div>
      )}

      {/* Status Notice */}
      {replaceNotice && (
        <div className="px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in">
          <Check className="w-3 h-3" />
          <span>{replaceNotice}</span>
        </div>
      )}
    </div>
  );
};

