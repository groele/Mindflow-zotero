import React, { useState, useEffect } from 'react';
import { InboxItem } from '../../core/model/types';
import { InboxService } from '../../services/storage/inboxService';
import {
  Inbox, X, Plus, Trash2, Globe, ArrowRight,
  CheckCircle2, Sparkles
} from 'lucide-react';

interface InboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToMap: (item: InboxItem) => void;
}

export const InboxDrawer: React.FC<InboxDrawerProps> = ({
  isOpen,
  onClose,
  onInsertToMap,
}) => {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [inputText, setInputText] = useState('');

  const loadItems = async () => {
    const list = await InboxService.getItems();
    setItems(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickAdd = async () => {
    if (!inputText.trim()) return;
    await InboxService.addItem(inputText.trim());
    setInputText('');
    await loadItems();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await InboxService.deleteItem(id);
    await loadItems();
  };

  const handleInsert = async (item: InboxItem) => {
    onInsertToMap(item);
    await InboxService.markProcessed(item.id, true);
    await loadItems();
  };

  const handleClearProcessed = async () => {
    await InboxService.clearProcessed();
    await loadItems();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-xs uppercase tracking-wider">
          <Inbox className="w-4 h-4 text-blue-600" />
          <span>灵感与收集箱 (Inbox)</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Input box */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="捕捉一个闪念或待办..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd();
            }}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-blue-400"
          />
          <button
            onClick={handleQuickAdd}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>网页划词或右键可随时存入此处</span>
          {items.some(i => i.isProcessed) && (
            <button
              onClick={handleClearProcessed}
              className="text-blue-500 hover:underline text-[10px]"
            >
              清空已入图
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {items.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Sparkles className="w-6 h-6 mx-auto opacity-40 text-blue-500" />
            <p>收集箱空空如也</p>
            <p className="text-[10px] text-slate-400 max-w-[180px] mx-auto">
              在任意网页中选中文本并右键「收集到收集箱」，即可在这里集中梳理
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all space-y-2 group ${
                item.isProcessed
                  ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-300'
              }`}
            >
              {/* Top info */}
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1 min-w-0">
                  {item.url && <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  <span className="truncate">{item.title || '快捷摘录'}</span>
                </div>
                <span>{formatDate(item.createdAt)}</span>
              </div>

              {/* Text content */}
              <p className="text-slate-800 dark:text-slate-200 font-medium line-clamp-3 leading-relaxed">
                {item.text}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  onClick={() => handleInsert(item)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>{item.isProcessed ? '再次加入导图' : '一键加入导图'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {item.isProcessed && (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 mr-1">
                      <CheckCircle2 className="w-3 h-3" /> 已整理
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
