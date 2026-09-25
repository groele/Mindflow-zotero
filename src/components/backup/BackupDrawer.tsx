import React, { useState, useEffect, useRef } from 'react';
import { MindMapDocument } from '../../core/model/types';
import { BackupService, DocSnapshot, StorageQuotaInfo } from '../../services/storage/backupService';
import { SettingsService } from '../../services/storage/settingsService';
import {
  ShieldCheck, Download, Upload, History, Plus,
  RotateCcw, Trash2, HardDrive, AlertCircle, X, Check
} from 'lucide-react';

interface BackupDrawerProps {
  currentDoc: MindMapDocument;
  isOpen: boolean;
  onClose: () => void;
  onRestoreSnapshot: (restoredDoc: MindMapDocument) => void;
  onReloadWorkspace: () => void;
}

export const BackupDrawer: React.FC<BackupDrawerProps> = ({
  currentDoc,
  isOpen,
  onClose,
  onRestoreSnapshot,
  onReloadWorkspace,
}) => {
  const [snapshots, setSnapshots] = useState<DocSnapshot[]>([]);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [maxSnapshots, setMaxSnapshots] = useState(20);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const snaps = await BackupService.getSnapshots(currentDoc.id);
    setSnapshots(snaps);
    const settings = await SettingsService.getSettings();
    setMaxSnapshots(settings.maxSnapshotsPerDoc);
    const q = await BackupService.getStorageQuota();
    setQuota(q);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentDoc.id]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleCreateSnapshot = async () => {
    try {
      await BackupService.createSnapshot(currentDoc);
      await loadData();
      showNotice('已为当前导图生成新快照！');
    } catch (error: any) {
      showNotice(`快照生成失败：${error?.message || '本地存储不可用'}`);
    }
  };

  const handleRestore = async (snapId: string) => {
    if (confirm('确认将当前导图还原至此历史快照？当前未保存的临时改动将被覆盖。')) {
      const restored = await BackupService.restoreSnapshot(currentDoc.id, snapId);
      if (restored) {
        onRestoreSnapshot(restored);
        showNotice('已成功恢复至该快照！');
      }
    }
  };

  const handleDeleteSnapshot = async (snapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await BackupService.deleteSnapshot(currentDoc.id, snapId);
    await loadData();
  };

  const handleExportWorkspace = async () => {
    try {
      await BackupService.exportFullWorkspaceBackup();
      showNotice('工作区备份已导出！');
    } catch (error: any) {
      showNotice(`备份导出失败：${error?.message || '读取本地数据失败'}`);
    }
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
        showNotice(`已成功还原 ${res.docCount} 篇思维导图与 ${res.inboxCount} 条收集箱记录！`);
        onReloadWorkspace();
      } catch (err: any) {
        alert('备份文件格式解析失败：' + (err?.message || '未知错误'));
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
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>数据安全与备份</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="mx-3 mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-700 dark:text-slate-300">
        {/* Storage Quota Card */}
        {quota && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                <span>本地存储占用</span>
              </div>
              <span>{formatSize(quota.usedBytes)} / {formatSize(quota.maxBytes)}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${quota.percent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.max(quota.percent, 2)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              数据默认保存在此设备。启用 WebDAV 后，备份会上传到您配置的服务器。
            </p>
          </div>
        )}

        {/* Full Workspace Backup / Restore */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-blue-600" /> 全量工作区备份
          </label>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            将全部思维导图、灵感收集箱与版本快照导出为 JSON 文件。WebDAV 密码等连接凭据不会写入备份。
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleExportWorkspace}
              className="py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出全量备份</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-500" />
              <span>还原备份</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportWorkspace}
              className="hidden"
            />
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* Current Document Version Snapshots */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-purple-600" /> 当前导图快照历史
            </label>
            <button
              onClick={handleCreateSnapshot}
              className="px-2 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 hover:bg-purple-100 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> 生成快照
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            自动按设置间隔保存；最多保留最近 {maxSnapshots} 个版本，也可手动创建快照：
          </p>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pt-1">
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto opacity-40" />
                <p>暂无快照记录</p>
                <p className="text-[10px]">编辑会按设置间隔自动保存，也可点击「生成快照」立即保留</p>
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between group hover:border-purple-300 transition-all"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-medium text-xs text-slate-800 dark:text-slate-100 truncate">
                      {snap.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{formatDate(snap.timestamp)}</span>
                      <span>•</span>
                      <span>{snap.nodeCount} 个主题节点</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRestore(snap.id)}
                      title="回滚到此快照版本"
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                      title="删除此快照"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
