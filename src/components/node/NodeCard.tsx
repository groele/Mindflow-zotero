import React, { useState, useEffect, useRef } from 'react';
import { LayoutNode } from '../../core/model/types';
import { ExternalLink, FileText, ChevronRight, Tag, Star, Flag, CheckCircle2, HelpCircle } from 'lucide-react';

interface NodeCardProps {
  layoutNode: LayoutNode;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, newText: string) => void;
  onCancelEdit: () => void;
  onToggleCollapse: (id: string) => void;
  onToggleTaskStatus?: (id: string) => void;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDrop?: (targetId: string, e: React.DragEvent) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  layoutNode,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onToggleCollapse,
  onToggleTaskStatus,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const { node, x, y, width, height, level, color, shape } = layoutNode;
  const [editText, setEditText] = useState(node.text);
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
      onDragOver={(e) => onDragOver && onDragOver(node.id, e)}
      onDrop={(e) => onDrop && onDrop(node.id, e)}
      onClick={(e) => onSelect(node.id, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(node.id);
      }}
      className={`
        absolute select-none flex items-center justify-between px-3 cursor-pointer transition-all duration-150
        ${shapeClasses}
        ${isRoot ? 'shadow-lg font-bold text-base' : 'text-sm font-medium border'}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent shadow-node-selected z-20' : 'shadow-node hover:shadow-node-hover z-10'}
        ${shape !== 'underline' ? 'backdrop-blur-sm' : ''}
      `}
    >
      {/* Content wrapper */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
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
        ) : (
          <span className={`truncate flex-1 tracking-wide leading-tight ${node.task?.status === 'done' ? 'line-through opacity-60' : ''}`}>
            {node.text}
          </span>
        )}

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

        {/* Note indicator */}
        {node.note && (
          <span title={node.note} className="flex-shrink-0 text-slate-400 hover:text-amber-500 transition-colors">
            <FileText className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Hyperlink button */}
        {node.link && (
          <a
            href={node.link}
            target="_blank"
            rel="noopener noreferrer"
            title={node.link}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-blue-500 hover:text-blue-700 p-0.5 rounded hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Collapse/Expand button for nodes with children */}
      {hasChildren && !isRoot && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
          title={isCollapsed ? `展开 ${node.children.length} 个子主题` : '收起子主题'}
          className={`
            absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center
            text-[9px] font-bold shadow-sm transition-transform z-30
            ${isCollapsed 
              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110' 
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 opacity-0 group-hover:opacity-100 hover:opacity-100'}
          `}
          style={{
            opacity: isCollapsed ? 1 : undefined,
          }}
        >
          {isCollapsed ? node.children.length : <ChevronRight className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
};
