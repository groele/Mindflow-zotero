import React, { useState, useEffect, useRef } from 'react';
import { LayoutNode } from '../../core/model/types';
import { safeExternalUrl } from '../../core/model/links';
import { imageDisplayHeight, isSafeNodeImage } from '../../core/model/nodeImage';
import { ExternalLink, FileText, ChevronRight, ChevronDown, Tag, Star, Flag, CheckCircle2, HelpCircle, Link2, GraduationCap } from 'lucide-react';
import { openZoteroUri } from '../../services/zotero/zoteroBridge';

interface NodeCardProps {
  layoutNode: LayoutNode;
  isSelected: boolean;
  isEditing: boolean;
  isSearchMatched?: boolean;
  isTagMatched?: boolean;
  isTagDimmed?: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, newText: string) => void;
  onCancelEdit: () => void;
  onToggleCollapse: (id: string) => void;
  onToggleTaskStatus?: (id: string) => void;
  onOpenInternalLink?: (documentId: string, nodeId?: string) => void;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDrop?: (targetId: string, e: React.DragEvent) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  layoutNode,
  isSelected,
  isEditing,
  isSearchMatched = false,
  isTagMatched = false,
  isTagDimmed = false,
  onSelect,
  onContextMenu,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onToggleCollapse,
  onToggleTaskStatus,
  onOpenInternalLink,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const { node, x, y, width, height, level, color, shape } = layoutNode;
  const [editText, setEditText] = useState(node.text);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const [showNotePopover, setShowNotePopover] = useState(false);
  const isComposingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(node.text);
  }, [node.text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingRef.current) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onCommitEdit(node.id, editText);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditText(node.text);
      onCancelEdit();
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      onCommitEdit(node.id, editText);
    }
  };

  const hasChildren = node.children && node.children.length > 0;
  const externalUrl = safeExternalUrl(node.link);
  const nodeImage = isSafeNodeImage(node.image) ? node.image : null;
  const isCollapsed = node.isExpanded === false;

  // Visual shape style
  let shapeClasses = 'rounded-xl';
  if (shape === 'pill') shapeClasses = 'rounded-full';
  else if (shape === 'rectangle') shapeClasses = 'rounded-none';
  else if (shape === 'underline') shapeClasses = 'rounded-none border-b-2 bg-transparent shadow-none';

  // Level styles
  const isRoot = level === 0;
  const isLevel1 = level === 1;

  // Custom or theme colors
  const nodeStyle: React.CSSProperties = {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  };

  if (isRoot) {
    nodeStyle.backgroundColor = layoutNode.bgColor;
    nodeStyle.color = layoutNode.textColor;
  } else if (shape === 'underline') {
    nodeStyle.borderBottomColor = color;
    nodeStyle.color = layoutNode.textColor;
  } else {
    nodeStyle.backgroundColor = layoutNode.bgColor;
    nodeStyle.borderColor = isSelected ? '#3b82f6' : (isLevel1 ? color : '#e2e8f0');
    nodeStyle.color = layoutNode.textColor;
  }

  // Render icons
  const renderIconBadge = (iconName: string) => {
    switch (iconName) {
      case 'star': return <Star key={iconName} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />;
      case 'flag': return <Flag key={iconName} className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
      case 'check': return <CheckCircle2 key={iconName} className="w-3.5 h-3.5 text-emerald-500" />;
      case 'question': return <HelpCircle key={iconName} className="w-3.5 h-3.5 text-sky-500" />;
      case 'priority-1': return <span key={iconName} className="px-1 text-[10px] font-bold bg-red-500 text-white rounded">1</span>;
      case 'priority-2': return <span key={iconName} className="px-1 text-[10px] font-bold bg-amber-500 text-white rounded">2</span>;
      case 'priority-3': return <span key={iconName} className="px-1 text-[10px] font-bold bg-blue-500 text-white rounded">3</span>;
      default: return null;
    }
  };

  return (
    <div
      style={nodeStyle}
      draggable={!isEditing && !isRoot}
      onDragStart={(e) => onDragStart && onDragStart(node.id, e)}
      onDragEnd={() => { setIsDragOverTarget(false); onDragEnd?.(); }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOverTarget(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOverTarget(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOverTarget) setIsDragOverTarget(true);
        onDragOver && onDragOver(node.id, e);
      }}
      onDrop={(e) => {
        setIsDragOverTarget(false);
        onDrop && onDrop(node.id, e);
      }}
      onClick={(e) => onSelect(node.id, e)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu && onContextMenu(node.id, e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(node.id);
      }}
      className={`
        absolute select-none flex px-3 cursor-pointer transition-all duration-150
        ${nodeImage ? 'flex-col items-center justify-center gap-1 py-2' : 'items-center justify-between'}
        ${shapeClasses}
        ${isRoot ? 'shadow-lg font-bold text-base' : 'text-sm font-medium border'}
        ${isDragOverTarget ? 'ring-2 ring-indigo-500 ring-offset-2 scale-[1.04] bg-indigo-50/40 dark:bg-indigo-950/50 shadow-xl z-40' : ''}
        ${isSelected && !isDragOverTarget ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent shadow-node-selected z-20' : 'shadow-node hover:shadow-node-hover z-10'}
        ${isSearchMatched ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-amber-100 dark:ring-offset-slate-900 shadow-lg scale-105 z-30' : ''}
        ${isTagMatched ? 'ring-2 ring-teal-500 ring-offset-2 ring-offset-teal-50 dark:ring-offset-slate-900 z-30' : ''}
        ${isTagDimmed ? 'opacity-25' : ''}
        ${shape !== 'underline' ? 'backdrop-blur-sm' : ''}
      `}
    >
      {/* Visual Drop Target Badge */}
      {isDragOverTarget && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-md whitespace-nowrap animate-bounce pointer-events-none z-50">
          ➕ 移至此分支
        </div>
      )}
      {nodeImage && (
        <img
          src={nodeImage.dataUrl}
          alt={node.text || '导图节点图片'}
          draggable={false}
          style={{ width: nodeImage.width, height: imageDisplayHeight(nodeImage) }}
          className="max-w-full object-contain rounded-md pointer-events-none"
        />
      )}
      {/* Content wrapper */}
      <div className={`flex items-center gap-1.5 min-w-0 overflow-hidden ${nodeImage ? 'w-full justify-center' : 'flex-1'}`}>
        {/* Node icons */}
        {node.icons && node.icons.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {node.icons.map(renderIconBadge)}
          </div>
        )}

        {/* Task Checkbox */}
        {node.task && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTaskStatus && onToggleTaskStatus(node.id);
            }}
            title={`任务状态: ${node.task.status === 'done' ? '已完成' : node.task.status === 'doing' ? '进行中' : '待办'} (点击切换)`}
            className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors border ${
              node.task.status === 'done'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : node.task.status === 'doing'
                ? 'bg-amber-100 border-amber-500 text-amber-600'
                : 'bg-white/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400'
            }`}
          >
            {node.task.status === 'done' && <span className="text-[10px] font-bold">✓</span>}
            {node.task.status === 'doing' && <span className="text-[9px] font-bold leading-none">◐</span>}
          </button>
        )}

        {/* Text or Input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            className="w-full bg-white/90 text-slate-900 px-1 py-0.5 rounded outline-none border border-blue-400 font-normal text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : node.text ? (
          <span
            title={node.text}
            className={`truncate flex-1 tracking-wide leading-tight ${node.task?.status === 'done' ? 'line-through opacity-60' : ''}`}
          >
            {node.text}
          </span>
        ) : null}

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {node.tags.slice(0, 2).map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                <Tag className="w-2.5 h-2.5 opacity-60" />
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Note indicator with interactive preview */}
        {node.note && (
          <div
            className="relative flex-shrink-0"
            onMouseEnter={() => setShowNotePopover(true)}
            onMouseLeave={() => setShowNotePopover(false)}
          >
            <button
              type="button"
              aria-label={`查看完整备注或摘要（${node.note.length} 字）`}
              aria-expanded={showNotePopover}
              title={`查看完整备注或摘要（${node.note.length} 字）`}
              onClick={(e) => {
                e.stopPropagation();
                setShowNotePopover(!showNotePopover);
              }}
              className="p-1 -m-1 text-slate-400 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded transition-colors cursor-pointer flex items-center"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            {showNotePopover && (
              <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="完整摘要或备注"
                style={{ width: 'min(70vw, 32rem)', maxHeight: 'min(60vh, 32rem)' }}
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 p-3 rounded-xl bg-slate-900/95 text-slate-100 text-xs shadow-2xl backdrop-blur-md border border-slate-700/80 z-50 pointer-events-auto leading-relaxed overflow-y-auto overscroll-contain whitespace-pre-wrap break-words animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="sticky top-0 -mt-0.5 pb-1.5 mb-1.5 bg-slate-900/95 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> 完整摘要 / 备注</span>
                  <span className="font-normal normal-case text-slate-400">{node.note.length} 字</span>
                </div>
                <div className="font-normal text-[11px] text-slate-200">
                  {node.note}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hyperlink button */}
        {node.internalLink && (
          <button
            type="button"
            title="打开关联导图主题"
            aria-label="打开关联导图主题"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInternalLink?.(node.internalLink!.documentId, node.internalLink!.nodeId);
            }}
            className="flex-shrink-0 text-violet-600 hover:text-violet-800 p-0.5 rounded hover:bg-violet-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        )}
        {externalUrl && (
          externalUrl.startsWith('zotero://') ? (
            <button
              type="button"
              title={externalUrl.startsWith('zotero://open-pdf/') ? '在 Zotero PDF 阅读器中查看原批注' : '在 Zotero 中定位关联条目'}
              aria-label={externalUrl.startsWith('zotero://open-pdf/') ? '查看原 PDF 批注' : '在 Zotero 中定位关联条目'}
              onClick={(e) => {
                e.stopPropagation();
                openZoteroUri(externalUrl);
              }}
              className="flex-shrink-0 text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors flex items-center"
            >
              <GraduationCap className="w-3.5 h-3.5" />
            </button>
          ) : (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={externalUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-blue-500 hover:text-blue-700 p-0.5 rounded hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )
        )}
      </div>

      {/* Collapse/Expand button for nodes with children */}
      {hasChildren && !isRoot && (
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? `展开 ${node.children.length} 个子主题` : `收起 ${node.children.length} 个子主题`}
          title={isCollapsed ? `展开 ${node.children.length} 个子主题` : `收起 ${node.children.length} 个子主题`}
          className={`
            absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center
            border shadow-md transition-all duration-150 z-30 touch-manipulation
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            hover:scale-110 active:scale-95
            ${isCollapsed
              ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'}
          `}
        >
          {isCollapsed
            ? <ChevronRight className="w-4 h-4" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          {isCollapsed && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center bg-white text-blue-700 border border-blue-200 text-[9px] leading-none font-bold shadow-sm"
            >
              {node.children.length > 99 ? '99+' : node.children.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
