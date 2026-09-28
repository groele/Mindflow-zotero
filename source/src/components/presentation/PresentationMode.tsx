import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Maximize2, Minimize2,
  FileText
} from 'lucide-react';
import { MindMapNode, ThemeColors } from '../../core/model/types';

interface PresentationSlide {
  node: MindMapNode;
  path: string[];
  depth: number;
}

interface PresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  rootNode: MindMapNode;
  theme: ThemeColors;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  onClose,
  rootNode,
  theme: _theme,
}) => {
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Flatten the tree into an ordered presentation deck
  useEffect(() => {
    if (!isOpen) return;

    const list: PresentationSlide[] = [];
    const traverse = (node: MindMapNode, path: string[], depth: number) => {
      list.push({ node, path, depth });
      if (node.children) {
        for (const child of node.children) {
          traverse(child, [...path, node.text], depth + 1);
        }
      }
    };

    traverse(rootNode, [], 0);
    setSlides(list);
    setCurrentIndex(0);
  }, [isOpen, rootNode]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        handlePrev();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen || slides.length === 0) return null;

  const currentSlide = slides[currentIndex];
  const { node, path, depth } = currentSlide;
  const progressPercent = ((currentIndex + 1) / slides.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
            演说模式 • Slide {currentIndex + 1} / {slides.length}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            {path.map((segment, idx) => (
              <React.Fragment key={idx}>
                <span className="truncate max-w-[120px]">{segment}</span>
                <span className="text-slate-600">/</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? '退出全屏 (F)' : '全屏演示 (F)'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            title="退出演示 (Esc)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition-colors text-xs font-medium"
          >
            <X className="w-4 h-4" />
            <span>退出 (Esc)</span>
          </button>
        </div>
      </div>

      {/* Main Slide Presentation Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-16 max-w-5xl mx-auto w-full text-center relative overflow-y-auto">
        {/* Breadcrumb Focus */}
        {path.length > 0 && (
          <div className="mb-4 text-sm font-medium tracking-wide text-indigo-400/90 uppercase">
            {path.join('  ›  ')}
          </div>
        )}

        {/* Slide Title Node */}
        <div className="relative inline-block mb-8 max-w-3xl">
          <h1
            className={`
              font-extrabold tracking-tight text-white leading-tight
              ${depth === 0 ? 'text-4xl sm:text-6xl' : depth === 1 ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl'}
            `}
          >
            {node.text}
          </h1>


        </div>

        {/* Note / Annotation */}
        {node.note && (
          <div className="mb-8 p-4 max-w-2xl bg-slate-900/80 border border-slate-800 rounded-xl text-slate-300 text-sm leading-relaxed text-left flex items-start gap-3 shadow-lg">
            <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{node.note}</p>
          </div>
        )}

        {/* Direct Children Preview */}
        {node.children && node.children.length > 0 && (
          <div className="w-full max-w-2xl text-left bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              下级分支 ({node.children.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {node.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-200 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  <span className="truncate">{child.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls & Progress Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="text-xs text-slate-400 hidden sm:block">
          按 <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[11px] text-slate-300">Space</kbd> 或 <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[11px] text-slate-300">→</kbd> 下一页，<kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[11px] text-slate-300">←</kbd> 上一页
        </div>

        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一页</span>
          </button>

          <span className="font-mono text-xs text-slate-400 px-2">
            {currentIndex + 1} / {slides.length}
          </span>

          <button
            onClick={handleNext}
            disabled={currentIndex === slides.length - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-sm font-medium text-white transition-colors shadow-lg shadow-indigo-600/20"
          >
            <span>下一页</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1 bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
