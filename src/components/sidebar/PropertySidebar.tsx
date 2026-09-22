import React, { useState, useEffect } from 'react';
import { MindMapNode, NodeShape, TaskStatus } from '../../core/model/types';
import {
  X, Tag, Link, FileText, Palette, Shapes,
  Star, Flag, CheckCircle2, HelpCircle, Plus, ListTodo
} from 'lucide-react';

interface PropertySidebarProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (id: string, patch: Partial<MindMapNode>) => void;
  onClose: () => void;
  dockSide?: 'left' | 'right';
}

const COLOR_PRESETS = [
  '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777',
  '#9333ea', '#4f46e5', '#334155', '#475569'
];

export const PropertySidebar: React.FC<PropertySidebarProps> = ({
  selectedNode,
  onUpdateNode,
  onClose,
  dockSide = 'right',
}) => {
  const [noteText, setNoteText] = useState('');
  const [linkText, setLinkText] = useState('');
  const [newTagText, setNewTagText] = useState('');

  useEffect(() => {
    if (selectedNode) {
      setNoteText(selectedNode.note || '');
      setLinkText(selectedNode.link || '');
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  const handleShapeChange = (shape: NodeShape) => {
    onUpdateNode(selectedNode.id, { shape });
  };

  const handleColorChange = (color: string) => {
    onUpdateNode(selectedNode.id, { color });
  };

  const handleNoteBlur = () => {
    onUpdateNode(selectedNode.id, { note: noteText.trim() || undefined });
  };

  const handleLinkBlur = () => {
    onUpdateNode(selectedNode.id, { link: linkText.trim() || undefined });
  };

  const handleAddTag = () => {
    const trimmed = newTagText.trim();
    if (!trimmed) return;
    const currentTags = selectedNode.tags || [];
    if (!currentTags.includes(trimmed)) {
      onUpdateNode(selectedNode.id, { tags: [...currentTags, trimmed] });
    }
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = selectedNode.tags || [];
    onUpdateNode(selectedNode.id, {
      tags: currentTags.filter(t => t !== tagToRemove)
    });
  };

  const toggleIcon = (iconName: string) => {
    const currentIcons = selectedNode.icons || [];
    if (currentIcons.includes(iconName)) {
      onUpdateNode(selectedNode.id, {
        icons: currentIcons.filter(i => i !== iconName)
      });
    } else {
      onUpdateNode(selectedNode.id, {
        icons: [...currentIcons, iconName]
      });
    }
  };

  const currentIcons = selectedNode.icons || [];

  return (
    <aside className={`w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800 flex flex-col h-full z-20 select-none shadow-xl ${dockSide === 'left' ? 'border-r order-first animate-in slide-in-from-left duration-150' : 'border-l order-last animate-in slide-in-from-right duration-150'}`}>
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          主题样式与属性
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-700 dark:text-slate-300">
        {/* Node Shape */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Shapes className="w-3.5 h-3.5" /> 节点形状
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['rounded', 'pill', 'rectangle', 'underline'] as NodeShape[]).map((shape) => (
              <button
                key={shape}
                onClick={() => handleShapeChange(shape)}
                className={`py-1.5 text-center text-[11px] rounded-lg border transition-all ${
                  (selectedNode.shape || 'rounded') === shape
                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {shape === 'rounded' ? '圆角' : shape === 'pill' ? '胶囊' : shape === 'rectangle' ? '矩形' : '下划线'}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Palette className="w-3.5 h-3.5" /> 分支与高亮颜色
          </label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                  selectedNode.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                }`}
              />
            ))}
          </div>
        </div>

        {/* Priority & Status Badges */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Star className="w-3.5 h-3.5" /> 图标徽章
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => toggleIcon('priority-1')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-1') ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P1
            </button>
            <button
              onClick={() => toggleIcon('priority-2')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-2') ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P2
            </button>
            <button
              onClick={() => toggleIcon('priority-3')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-3') ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P3
            </button>
            <button
              onClick={() => toggleIcon('star')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('star') ? 'bg-amber-100 border-amber-400 text-amber-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('flag')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('flag') ? 'bg-red-100 border-red-400 text-red-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('check')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('check') ? 'bg-emerald-100 border-emerald-400 text-emerald-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('question')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('question') ? 'bg-sky-100 border-sky-400 text-sky-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Management */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <ListTodo className="w-3.5 h-3.5 text-blue-600" /> 任务待办 (Task)
            </label>
            <button
              onClick={() => {
                if (selectedNode.task) {
                  onUpdateNode(selectedNode.id, { task: undefined });
                } else {
                  onUpdateNode(selectedNode.id, { task: { status: 'todo' } });
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                selectedNode.task
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
              }`}
            >
              {selectedNode.task ? '开启中' : '设为任务'}
            </button>
          </div>

          {selectedNode.task && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-1">
                {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onUpdateNode(selectedNode.id, {
                        task: { ...selectedNode.task!, status: st }
                      });
                    }}
                    className={`py-1 text-center rounded text-[11px] font-medium border transition-colors ${
                      selectedNode.task?.status === st
                        ? st === 'done' ? 'bg-emerald-500 text-white border-emerald-500'
                          : st === 'doing' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {st === 'todo' ? '待办' : st === 'doing' ? '进行中' : '已完成'}
                  </button>
                ))}
              </div>

              {/* Due Date */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">截止日期:</span>
                <input
                  type="date"
                  value={selectedNode.task.dueDate || ''}
                  onChange={(e) => {
                    onUpdateNode(selectedNode.id, {
                      task: { ...selectedNode.task!, dueDate: e.target.value || undefined }
                    });
                  }}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[11px] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Hyperlink */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-1.5">
            <Link className="w-3.5 h-3.5" /> 超链接网址
          </label>
          <input
            type="url"
            value={linkText}
            placeholder="https://example.com"
            onChange={(e) => setLinkText(e.target.value)}
            onBlur={handleLinkBlur}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-1.5">
            <Tag className="w-3.5 h-3.5" /> 标签
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedNode.tags?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px]"
              >
                {t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-blue-900"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newTagText}
              placeholder="新增标签名"
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs"
            />
            <button
              onClick={handleAddTag}
              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-1.5">
            <FileText className="w-3.5 h-3.5" /> 备注注释
          </label>
          <textarea
            rows={4}
            value={noteText}
            placeholder="为该主题添加长文本备注或待办细节..."
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs resize-none"
          />
        </div>
      </div>
    </aside>
  );
};
