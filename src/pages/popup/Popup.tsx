import React, { useState, useEffect } from 'react';
import { StorageService, DocumentSummary } from '../../services/storage/storageService';
import { addChildNode, updateNode } from '../../core/model/treeOps';
import {
  Maximize2, Sidebar, Plus, Globe, FileText,
  ExternalLink, Check
} from 'lucide-react';

export const Popup: React.FC = () => {
  const [docList, setDocList] = useState<DocumentSummary[]>([]);
  const [activeTitle, setActiveTitle] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [currentTabInfo, setCurrentTabInfo] = useState<{ title?: string; url?: string }>({});
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    StorageService.getDocumentList().then(setDocList);
    StorageService.getActiveDocument().then((doc) => {
      setActiveTitle(doc.title);
    });

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          setCurrentTabInfo({ title: tabs[0].title, url: tabs[0].url });
        }
      });
    }
  }, []);

  const openFullscreen = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open('index.html', '_blank');
    }
  };

  const openSidepanel = () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.sidePanel.open({ tabId: tabs[0].id });
          window.close();
        }
      });
    } else {
      openFullscreen();
    }
  };

  const handleQuickAdd = async (text: string, link?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const doc = await StorageService.getActiveDocument();
    const { newRoot, newNodeId } = addChildNode(doc.root, doc.root.id, trimmed);
    const finalRoot = link ? updateNode(newRoot, newNodeId, { link }) : newRoot;
    doc.root = finalRoot;
    await StorageService.saveDocument(doc);

    setQuickInput('');
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  return (
    <div className="w-[360px] p-4 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col gap-4 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">MindFlow</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">现代思维导图与伴读</p>
          </div>
        </div>
        <button
          onClick={openFullscreen}
          title="全屏打开"
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={openFullscreen}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>全屏沉浸创作</span>
        </button>

        <button
          onClick={openSidepanel}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
        >
          <Sidebar className="w-3.5 h-3.5 text-blue-600" />
          <span>侧边伴读模式</span>
        </button>
      </div>

      {/* Quick Add into Active Map */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span className="truncate max-w-[200px]">
            当前导图: <strong className="text-slate-700 dark:text-slate-200">{activeTitle || '未命名'}</strong>
          </span>
          {isSavedNotice && (
            <span className="flex items-center gap-0.5 text-emerald-600 text-[10px]">
              <Check className="w-3 h-3" /> 已添加到导图
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="随时记录一个闪念/待办..."
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleQuickAdd(quickInput);
              }
            }}
            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-400"
          />
          <button
            onClick={() => handleQuickAdd(quickInput)}
            className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Current tab quick capture */}
        {currentTabInfo.title && (
          <button
            onClick={() => handleQuickAdd(currentTabInfo.title || '网页', currentTabInfo.url)}
            className="w-full text-left flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="truncate">{currentTabInfo.title}</span>
            </div>
            <span className="text-[10px] text-blue-600 font-medium flex-shrink-0 flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> 采集
            </span>
          </button>
        )}
      </div>

      {/* Recent Docs */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          最近导图
        </div>
        <div className="max-h-36 overflow-y-auto space-y-1">
          {docList.slice(0, 4).map((doc) => (
            <div
              key={doc.id}
              onClick={async () => {
                await StorageService.setActiveDocumentId(doc.id);
                openFullscreen();
              }}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                  {doc.title}
                </span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
