import React, { useState, useEffect } from 'react';
import { StorageService, DocumentSummary } from '../../services/storage/storageService';
import {
  X, Plus, FileText, Trash2, Search, Check, FolderOpen
} from 'lucide-react';

interface DocManagerSidebarProps {
  isOpen: boolean;
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onClose: () => void;
}

export const DocManagerSidebar: React.FC<DocManagerSidebarProps> = ({
  isOpen,
  activeDocId,
  onSelectDoc,
  onNewDoc,
  onClose,
}) => {
  const [docList, setDocList] = useState<DocumentSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadDocs = async () => {
    const list = await StorageService.getDocumentList();
    setDocList(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredDocs = docList.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这篇思维导图吗？此操作无法撤销。')) {
      await StorageService.deleteDocument(id);
      await loadDocs();
    }
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="relative w-80 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <span>我的思维导图</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and New Doc button */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <button
            onClick={() => {
              onNewDoc();
              onClose();
            }}
            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> 新建思维导图
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索导图文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              暂无导图文档
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => {
                  onSelectDoc(doc.id);
                  onClose();
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                  doc.id === activeDocId
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.id === activeDocId ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${doc.id === activeDocId ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {doc.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatDate(doc.updatedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {doc.id === activeDocId && (
                    <Check className="w-3.5 h-3.5 text-blue-600 mr-1" />
                  )}
                  {docList.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      title="删除文档"
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};
