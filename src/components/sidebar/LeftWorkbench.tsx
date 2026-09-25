import React, { useState, useEffect, useRef } from 'react';
import { MindMapDocument, MindMapNode, InboxItem } from '../../core/model/types';
import { StorageService, DocumentSummary } from '../../services/storage/storageService';
import { InboxService } from '../../services/storage/inboxService';
import { BackupService, DocSnapshot, StorageQuotaInfo } from '../../services/storage/backupService';
import { collectMapTasks } from '../../core/model/taskUtils';
import {
  FolderOpen, ListTree, Inbox, ShieldCheck, Plus, Search,
  Trash2, Check, Download, Upload, History, RotateCcw,
  FileText, PanelLeftClose, PanelLeftOpen, ArrowRight, HardDrive, ArrowLeftRight, X, Settings, ListTodo
} from 'lucide-react';

export type WorkbenchTab = 'docs' | 'outline' | 'tasks' | 'inbox' | 'backup';

interface LeftWorkbenchProps {
  currentDoc: MindMapDocument;
  selectedId: string | null;
  isOpen: boolean;
  activeTab: WorkbenchTab;
  dockPosition: 'left' | 'right';
  onToggleOpen: () => void;
  onTabChange: (tab: WorkbenchTab) => void;
  onToggleDockPosition: () => void;
  onOpenSettings?: () => void;
  onSelectDoc: (docId: string) => void;
  onNewDoc: () => void;
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeText: (id: string, text: string) => void;
  onAddChildNode: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
  onInsertInboxItem: (item: InboxItem) => void;
  onRestoreSnapshot: (restoredDoc: MindMapDocument) => void;
  onReloadWorkspace: () => void;
}

export const LeftWorkbench: React.FC<LeftWorkbenchProps> = ({
  currentDoc,
  selectedId,
  isOpen,
  activeTab,
  dockPosition,
  onToggleOpen,
  onTabChange,
  onToggleDockPosition,
  onOpenSettings,
  onSelectDoc,
  onNewDoc,
  onSelectNode,
  onUpdateNodeText,
  onAddChildNode,
  onDeleteNode,
  onInsertInboxItem,
  onRestoreSnapshot,
  onReloadWorkspace,
}) => {
  // Docs state
  const [docList, setDocList] = useState<DocumentSummary[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'doing' | 'done' | 'overdue'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Inbox state
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxInput, setInboxInput] = useState('');

  // Backup state
  const [snapshots, setSnapshots] = useState<DocSnapshot[]>([]);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

  // Outline inline editing state
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null);
  const [editingOutlineText, setEditingOutlineText] = useState('');

  // Load data for active tab
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'docs') {
        StorageService.getDocumentList().then(setDocList);
      } else if (activeTab === 'inbox') {
        InboxService.getItems().then(setInboxItems);
      } else if (activeTab === 'backup') {
        BackupService.getSnapshots(currentDoc.id).then(setSnapshots);
        BackupService.getStorageQuota().then(setQuota);
      }
    }
  }, [isOpen, activeTab, currentDoc.id]);

  const showBackupNotice = (msg: string) => {
    setBackupNotice(msg);
    setTimeout(() => setBackupNotice(null), 3000);
  };

  // --- Handlers for Docs ---
  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定删除该导图文档吗？此操作无法撤销。')) {
      await StorageService.deleteDocument(id);
      const list = await StorageService.getDocumentList();
      setDocList(list);
    }
  };

  // --- Handlers for Inbox ---
  const handleAddInboxItem = async () => {
    if (!inboxInput.trim()) return;
    await InboxService.addItem(inboxInput.trim());
    setInboxInput('');
    const items = await InboxService.getItems();
    setInboxItems(items);
  };

  const handleDeleteInboxItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await InboxService.deleteItem(id);
    const items = await InboxService.getItems();
    setInboxItems(items);
  };

  const handleClearProcessedInbox = async () => {
    await InboxService.clearProcessed();
    const items = await InboxService.getItems();
    setInboxItems(items);
  };

  // --- Handlers for Backup ---
  const handleCreateSnapshot = async () => {
    await BackupService.createSnapshot(currentDoc);
    const snaps = await BackupService.getSnapshots(currentDoc.id);
    setSnapshots(snaps);
    showBackupNotice('已生成新快照！');
  };

  const handleRestoreSnapshot = async (snapId: string) => {
    if (confirm('确认将当前导图回滚至此历史快照？')) {
      try {
        const restored = await BackupService.restoreSnapshot(currentDoc.id, snapId);
        if (restored) {
          onRestoreSnapshot(restored);
          showBackupNotice('已成功还原至该快照！');
        }
      } catch (error: any) {
        showBackupNotice(`恢复失败：${error?.message || '请检查存储空间或其他窗口中的编辑'}`);
      }
    }
  };

  const handleDeleteSnapshot = async (snapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await BackupService.deleteSnapshot(currentDoc.id, snapId);
    const snaps = await BackupService.getSnapshots(currentDoc.id);
    setSnapshots(snaps);
  };

  const handleExportWorkspace = async () => {
    await BackupService.exportFullWorkspaceBackup();
    showBackupNotice('全量工作区导出成功！');
  };

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const res = await BackupService.importFullWorkspaceBackup(content);
        showBackupNotice(`已还原 ${res.docCount} 篇思维导图与 ${res.inboxCount} 条收集箱记录！`);
        onReloadWorkspace();
      } catch (err: any) {
        alert('解析失败: ' + (err?.message || '未知错误'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Outline sub-tree component
  const renderOutlineTree = (node: MindMapNode, level: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id} className="flex flex-col">
        <div
          onClick={() => onSelectNode(node.id)}
          className={`group flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 font-semibold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          style={{ paddingLeft: `${level * 14 + 6}px` }}
        >
          <span className="w-3.5 text-center text-[10px] text-slate-400">
            {hasChildren ? '•' : '–'}
          </span>
          {editingOutlineId === node.id ? (
            <input
              autoFocus
              value={editingOutlineText}
              onChange={(e) => setEditingOutlineText(e.target.value)}
              onBlur={() => {
                if (editingOutlineText.trim()) {
                  onUpdateNodeText(node.id, editingOutlineText.trim());
                }
                setEditingOutlineId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingOutlineText.trim()) {
                    onUpdateNodeText(node.id, editingOutlineText.trim());
                  }
                  setEditingOutlineId(null);
                } else if (e.key === 'Escape') {
                  setEditingOutlineId(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-1 py-0.5 text-xs bg-white dark:bg-slate-800 border border-blue-400 rounded outline-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingOutlineId(node.id);
                setEditingOutlineText(node.text);
              }}
              className="flex-1 truncate text-xs leading-relaxed"
              title="双击可编辑文本"
            >
              {node.text}
            </span>
          )}
          {node.task && (
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${node.task.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {node.task.status === 'done' ? '✓' : '待办'}
            </span>
          )}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddChildNode(node.id);
              }}
              title="插入子项"
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
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
                className="p-0.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && node.children.map(child => renderOutlineTree(child, level + 1))}
      </div>
    );
  };

  const isLeftDock = dockPosition === 'left';
  const tasks = collectMapTasks(currentDoc.root);
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const overdueTasks = tasks.filter(task => task.overdue).length;
  const filteredTasks = tasks.filter(task =>
    (taskFilter === 'all' || (taskFilter === 'overdue' ? task.overdue : task.status === taskFilter)) &&
    task.text.toLocaleLowerCase().includes(taskSearch.trim().toLocaleLowerCase())
  );

  return (
    <div className={`relative flex h-full z-30 select-none ${isLeftDock ? 'order-first' : 'order-last'}`}>
      {/* 1. Mini Navigation Rail (Always visible icon strip, 44px) */}
      <aside className={`w-11 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800 flex flex-col items-center py-3 justify-between z-40 ${isLeftDock ? 'border-r' : 'border-l'}`}>
        {/* Top Feature Tabs */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          <button
            onClick={() => {
              if (isOpen && activeTab === 'docs') onToggleOpen();
              else { onTabChange('docs'); if (!isOpen) onToggleOpen(); }
            }}
            title="📑 文档库 (Documents)"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isOpen && activeTab === 'docs'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === 'outline') onToggleOpen();
              else { onTabChange('outline'); if (!isOpen) onToggleOpen(); }
            }}
            title="📝 结构大纲 (Outline)"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isOpen && activeTab === 'outline'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ListTree className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === 'tasks') onToggleOpen();
              else { onTabChange('tasks'); if (!isOpen) onToggleOpen(); }
            }}
            title="任务总览与筛选"
            aria-label="任务总览与筛选"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen && activeTab === 'tasks' ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/40' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <ListTodo className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === 'inbox') onToggleOpen();
              else { onTabChange('inbox'); if (!isOpen) onToggleOpen(); }
            }}
            title="📥 灵感与收集箱 (Inbox)"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors relative ${
              isOpen && activeTab === 'inbox'
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === 'backup') onToggleOpen();
              else { onTabChange('backup'); if (!isOpen) onToggleOpen(); }
            }}
            title="💾 数据安全与备份 (Security & Snapshots)"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isOpen && activeTab === 'backup'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Utility Controls */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="系统设置 (Ctrl+,)"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onToggleDockPosition}
            title={isLeftDock ? '切换停靠至右侧' : '切换停靠至左侧'}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleOpen}
            title={isOpen ? '收起工作台' : '展开工作台'}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* 2. Expandable Content Drawer (280px) */}
      {isOpen && (
        <div className={`w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl animate-in ${isLeftDock ? 'slide-in-from-left border-r' : 'slide-in-from-right border-l'}`}>
          {/* Header */}
          <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
              {activeTab === 'docs' && <><FolderOpen className="w-4 h-4 text-blue-600" /> 我的导图文档</>}
              {activeTab === 'outline' && <><ListTree className="w-4 h-4 text-blue-600" /> 结构化大纲</>}
              {activeTab === 'tasks' && <><ListTodo className="w-4 h-4 text-violet-600" /> 任务总览</>}
              {activeTab === 'inbox' && <><Inbox className="w-4 h-4 text-amber-500" /> 灵感与收集箱</>}
              {activeTab === 'backup' && <><ShieldCheck className="w-4 h-4 text-emerald-600" /> 数据安全与备份</>}
            </span>
            <button
              onClick={onToggleOpen}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TAB 1: DOCUMENTS */}
          {activeTab === 'docs' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  onClick={onNewDoc}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> 新建导图 (选择模板)
                </button>
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索导图文档..."
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {docList
                  .filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase()))
                  .map((d) => (
                    <div
                      key={d.id}
                      onClick={() => onSelectDoc(d.id)}
                      className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                        d.id === currentDoc.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className={`w-3.5 h-3.5 ${d.id === currentDoc.id ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-medium truncate ${d.id === currentDoc.id ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                            {d.title}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatDate(d.updatedAt)}
                          </div>
                        </div>
                      </div>
                      {docList.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteDoc(d.id, e)}
                          title="删除导图"
                          className="p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 2: OUTLINE */}
          {activeTab === 'outline' && (
            <div className="flex-1 overflow-y-auto p-2 text-xs">
              {renderOutlineTree(currentDoc.root, 0)}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <div className="flex justify-between font-semibold"><span>完成进度</span><span>{completedTasks}/{tasks.length} · {tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0}%</span></div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={completedTasks} aria-valuemax={tasks.length} aria-valuemin={0}>
                  <div className="h-full bg-emerald-500" style={{ width: `${tasks.length ? completedTasks / tasks.length * 100 : 0}%` }} />
                </div>
                <p className="text-slate-500">进行中 {tasks.filter(task => task.status === 'doing').length} · 已逾期 {overdueTasks}</p>
              </div>
              <input value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="搜索任务" aria-label="搜索任务" className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
              <select value={taskFilter} onChange={event => setTaskFilter(event.target.value as typeof taskFilter)} aria-label="筛选任务状态" className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <option value="all">全部任务</option><option value="todo">待办</option><option value="doing">进行中</option><option value="done">已完成</option><option value="overdue">已逾期</option>
              </select>
              <div className="space-y-1">
                {filteredTasks.length === 0 && <p className="py-5 text-center text-slate-500">没有符合条件的任务</p>}
                {filteredTasks.map(task => (
                  <button key={task.nodeId} onClick={() => onSelectNode(task.nodeId)} className={`w-full text-left p-2 rounded-lg border hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-slate-800 ${selectedId === task.nodeId ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className="block font-medium truncate" title={task.text}>{task.text}</span>
                    <span className={task.overdue ? 'text-red-600' : 'text-slate-500'}>{task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待办'}{task.dueDate ? ` · 截止 ${task.dueDate}` : ''}{task.overdue ? ' · 已逾期' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INBOX */}
          {activeTab === 'inbox' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="捕捉闪念/待办..."
                    value={inboxInput}
                    onChange={(e) => setInboxInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddInboxItem(); }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={handleAddInboxItem}
                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>网页划词直接存入此处</span>
                  {inboxItems.some(i => i.isProcessed) && (
                    <button onClick={handleClearProcessedInbox} className="text-blue-500 hover:underline">
                      清空已入图
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {inboxItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1">
                    <Inbox className="w-6 h-6 mx-auto opacity-30 text-amber-500" />
                    <p className="text-xs">收集箱空空如也</p>
                  </div>
                ) : (
                  inboxItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border transition-all space-y-1.5 group ${
                        item.isProcessed
                          ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 opacity-60'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {item.text}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
                        <button
                          onClick={() => {
                            onInsertInboxItem(item);
                            InboxService.markProcessed(item.id, true);
                            InboxService.getItems().then(setInboxItems);
                          }}
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>{item.isProcessed ? '再次加入' : '加入导图'}</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteInboxItem(item.id, e)}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & SNAPSHOTS */}
          {activeTab === 'backup' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {backupNotice && (
                <div className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{backupNotice}</span>
                </div>
              )}

              {/* Quota */}
              {quota && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-blue-500" /> 本地存储配额</span>
                    <span>{formatSize(quota.usedBytes)} / {formatSize(quota.maxBytes)}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.max(quota.percent, 2)}%` }} />
                  </div>
                </div>
              )}

              {/* Full Workspace Actions */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-blue-600" /> 全量工作区备份
                </label>
                <p className="text-[10px] text-slate-400">将全部导图、收集箱与快照打包备份为 JSON：</p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={handleExportWorkspace}
                    className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" /> 导出备份
                  </button>
                  <button
                    onClick={() => backupFileRef.current?.click()}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold flex items-center justify-center gap-1"
                  >
                    <Upload className="w-3 h-3 text-blue-500" /> 还原备份
                  </button>
                  <input ref={backupFileRef} type="file" accept=".json" onChange={handleImportWorkspace} className="hidden" />
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800" />

              {/* Document Snapshots */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-purple-600" /> 版本快照历史
                  </label>
                  <button
                    onClick={handleCreateSnapshot}
                    className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded text-[10px] font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> 生成快照
                  </button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {snapshots.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-[11px]">暂无快照记录</div>
                  ) : (
                    snapshots.map((s) => (
                      <div key={s.id} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/80 flex items-center justify-between group">
                        <div className="min-w-0 flex-1 mr-1">
                          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{formatDate(s.timestamp)}</div>
                          <div className="text-[10px] text-slate-400">{s.nodeCount} 个主题节点</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRestoreSnapshot(s.id)} title="还原此快照" className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => handleDeleteSnapshot(s.id, e)} title="删除快照" className="p-1 text-slate-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
