import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { MindMapNode } from '../../core/model/types';

interface CanvasSearchProps {
  isOpen: boolean;
  onClose: () => void;
  rootNode: MindMapNode;
  onJumpToNode: (nodeId: string) => void;
  onHighlightMatches: (matchedIds: string[]) => void;
}

export const CanvasSearch: React.FC<CanvasSearchProps> = ({
  isOpen,
  onClose,
  rootNode,
  onJumpToNode,
  onHighlightMatches,
}) => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
      setMatches([]);
      setCurrentIndex(0);
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
      const matchTag = node.tags?.some(t => t.toLowerCase().includes(q));

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
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-6 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="在导图中搜索 (Enter 下一个)..."
        className="w-48 sm:w-60 text-xs text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400"
      />

      {query && (
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 px-1">
          {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '无匹配'}
        </span>
      )}

      <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 dark:border-slate-700 pl-1 text-slate-500">
        <button
          onClick={handlePrev}
          disabled={matches.length === 0}
          title="上一个 (Shift+Enter)"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleNext}
          disabled={matches.length === 0}
          title="下一个 (Enter)"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          title="关闭 (Esc)"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
