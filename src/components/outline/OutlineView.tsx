import React, { useState } from 'react';
import { MindMapNode } from '../../core/model/types';
import {
  X, ChevronRight, ChevronDown, Plus, Trash2,
  ExternalLink, FileText
} from 'lucide-react';

interface OutlineViewProps {
  root: MindMapNode;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}

export const OutlineView: React.FC<OutlineViewProps> = ({
  root,
  selectedId,
  onSelectNode,
  onUpdateText,
  onAddChild,
  onDeleteNode,
  onClose,
}) => {
  return (
    <aside className="w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-20 select-none shadow-xl">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          📑 大纲视图 (Outline)
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Outliner tree content */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        <OutlineItem
          node={root}
          level={0}
          selectedId={selectedId}
          onSelectNode={onSelectNode}
          onUpdateText={onUpdateText}
          onAddChild={onAddChild}
          onDeleteNode={onDeleteNode}
        />
      </div>
    </aside>
  );
};

interface OutlineItemProps {
  node: MindMapNode;
  level: number;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
}

const OutlineItem: React.FC<OutlineItemProps> = ({
  node,
  level,
  selectedId,
  onSelectNode,
  onUpdateText,
  onAddChild,
  onDeleteNode,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleCommit = () => {
    setIsEditing(false);
    if (editText.trim() && editText !== node.text) {
      onUpdateText(node.id, editText.trim());
    }
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onSelectNode(node.id)}
        className={`group flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-semibold'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Toggle arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={`w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Text */}
        {isEditing ? (
          <input
            type="text"
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white border border-blue-400 px-1 py-0.5 rounded outline-none text-xs"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="flex-1 truncate leading-relaxed"
          >
            {node.text}
          </span>
        )}

        {/* Indicators */}
        {node.link && <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0" />}
        {node.note && <FileText className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        {node.tags && node.tags.length > 0 && (
          <span className="text-[10px] text-slate-400 flex-shrink-0">
            #{node.tags[0]}
          </span>
        )}

        {/* Quick action buttons on hover */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            title="添加子项"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
          >
            <Plus className="w-3 h-3" />
          </button>
          {level > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(node.id);
              }}
              title="删除"
              className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <OutlineItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              onUpdateText={onUpdateText}
              onAddChild={onAddChild}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
