import React, { useState, useEffect, useRef } from 'react';
import {
  X, Sliders, Cloud, ShieldCheck, Settings, Info, Check, AlertCircle,
  Eye, EyeOff, Loader2, Upload, Download, RefreshCw, HardDrive, Trash2,
  Crown, Key, Award, Sparkles, CheckCircle2
} from 'lucide-react';
import { AppSettings, WebDAVConfig } from '../../core/model/settingsTypes';
import { SettingsService } from '../../services/storage/settingsService';
import { WebDAVService, WebDAVSyncResult } from '../../services/sync/webdavService';
import { BackupService, StorageQuotaInfo } from '../../services/storage/backupService';
import { LicenseService, LicenseInfo } from '../../services/license/licenseService';
import { THEMES } from '../../core/theme/themes';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onReloadWorkspace?: () => void;
  onLicenseChanged?: () => void;
}

type SettingsTab = 'interface' | 'webdav' | 'backup' | 'editing' | 'license' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onReloadWorkspace,
  onLicenseChanged,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
  const [showPassword, setShowPassword] = useState(false);

  // WebDAV test and sync states
  const [testingWebDAV, setTestingWebDAV] = useState(false);
  const [testResult, setTestResult] = useState<WebDAVSyncResult | null>(null);
  const [syncingWebDAV, setSyncingWebDAV] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Backup states
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // License & Commercial states
  const [license, setLicense] = useState<LicenseInfo>({ tier: 'free' });
  const [activationKey, setActivationKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateNotice, setActivateNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      BackupService.getStorageQuota().then(setQuota);
      LicenseService.getLicense().then(setLicense);
      setTestResult(null);
      setSyncNotice(null);
      setBackupNotice(null);
      setActivateNotice(null);
    }
  }, [isOpen]);

  const handleActivate = async () => {
    if (!activationKey.trim()) {
      setActivateNotice({ success: false, message: '请输入有效的激活码' });
      return;
    }
    setActivating(true);
    setActivateNotice(null);
    const res = await LicenseService.activate(activationKey);
    setActivating(false);
    if (res.success) {
      const updatedLicense = await LicenseService.getLicense();
      setLicense(updatedLicense);
      setActivateNotice({ success: true, message: '🎉 恭喜！MindFlow Pro 终身版已成功激活！' });
      setActivationKey('');
      if (onLicenseChanged) onLicenseChanged();
    } else {
      setActivateNotice({ success: false, message: res.error || '激活失败' });
    }
  };

  const handleDeactivate = async () => {
    if (window.confirm('确定要注销当前的 Pro 授权吗？')) {
      await LicenseService.deactivate();
      const updated = await LicenseService.getLicense();
      setLicense(updated);
      setActivateNotice({ success: true, message: '已成功注销授权，当前已恢复为免费版。' });
      if (onLicenseChanged) onLicenseChanged();
    }
  };

  const handleGenerateTrialKey = () => {
    const trialKey = LicenseService.generateLicenseKey('pro');
    setActivationKey(trialKey);
  };

  if (!isOpen) return null;

  const handleSaveSettings = async (patch: Partial<AppSettings>) => {
    const updated = await SettingsService.updateSettings(patch);
    setCurrentSettings(updated);
    onUpdateSettings(updated);
  };

  const handleWebDAVFieldChange = <K extends keyof WebDAVConfig>(field: K, value: WebDAVConfig[K]) => {
    const newWebDAV = {
      ...currentSettings.webdav,
      [field]: value,
    };
    handleSaveSettings({ webdav: newWebDAV });
  };

  const handleApplyPreset = (preset: 'jianguoyun' | 'nextcloud' | 'synology') => {
    if (preset === 'jianguoyun') {
      handleSaveSettings({
        webdav: {
          ...currentSettings.webdav,
          enabled: true,
          serverUrl: 'https://dav.jianguoyun.com/dav/',
          basePath: '/MindFlow/',
        },
      });
    } else if (preset === 'nextcloud') {
      handleSaveSettings({
        webdav: {
          ...currentSettings.webdav,
          enabled: true,
          serverUrl: 'https://your-domain.com/remote.php/dav/files/USERNAME/',
          basePath: '/MindFlow/',
        },
      });
    } else if (preset === 'synology') {
      handleSaveSettings({
        webdav: {
          ...currentSettings.webdav,
          enabled: true,
          serverUrl: 'https://your-nas:5006/home/',
          basePath: '/MindFlow/',
        },
      });
    }
  };

  const handleTestWebDAV = async () => {
    setTestingWebDAV(true);
    setTestResult(null);
    try {
      const res = await WebDAVService.testConnection(currentSettings.webdav);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '网络连接失败' });
    } finally {
      setTestingWebDAV(false);
    }
  };

  const handleUploadToWebDAV = async () => {
    setSyncingWebDAV(true);
    setSyncNotice(null);
    try {
      const backupData = await BackupService.getFullWorkspaceData();
      const res = await WebDAVService.uploadBackup(currentSettings.webdav, backupData);
      setSyncNotice({ success: res.success, message: res.message });
      if (res.success) {
        handleWebDAVFieldChange('lastSyncTime', Date.now());
        handleWebDAVFieldChange('lastSyncStatus', 'success');
        handleWebDAVFieldChange('lastSyncMessage', res.message);
      }
    } catch (err: any) {
      setSyncNotice({ success: false, message: err.message || '上传异常' });
    } finally {
      setSyncingWebDAV(false);
    }
  };

  const handleDownloadFromWebDAV = async () => {
    if (!window.confirm('从云端拉取备份将导入远端所有导图。是否确认拉取？')) {
      return;
    }
    setSyncingWebDAV(true);
    setSyncNotice(null);
    try {
      const res = await WebDAVService.downloadBackup(currentSettings.webdav);
      if (res.success && res.data) {
        await BackupService.importFullWorkspaceData(res.data);
        setSyncNotice({ success: true, message: res.message });
        if (onReloadWorkspace) onReloadWorkspace();
      } else {
        setSyncNotice({ success: false, message: res.message });
      }
    } catch (err: any) {
      setSyncNotice({ success: false, message: err.message || '下载异常' });
    } finally {
      setSyncingWebDAV(false);
    }
  };

  const handleExportLocalWorkspace = async () => {
    await BackupService.exportFullWorkspaceBackup();
    setBackupNotice('工作区全量备份已导出！');
  };

  const handleImportLocalWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await BackupService.importFullWorkspaceData(parsed);
      setBackupNotice('工作区数据恢复成功！');
      if (onReloadWorkspace) onReloadWorkspace();
    } catch {
      setBackupNotice('导入失败：文件损坏或非标准 MindFlow 备份 JSON');
    }
  };

  const handleResetAllSettings = async () => {
    if (window.confirm('确定要将所有设置恢复为出厂默认值吗？')) {
      const def = await SettingsService.resetSettings();
      setCurrentSettings(def);
      onUpdateSettings(def);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[560px] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">系统设置与偏好</h2>
              <p className="text-[11px] text-slate-400">自定义工具栏、数据备份、WebDAV 云同步与高级偏好</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Tab Rail + Right Form Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Vertical Navigation */}
          <div className="w-44 border-r border-slate-200 dark:border-slate-800 p-2 space-y-1 bg-slate-50/60 dark:bg-slate-950/40">
            <button
              onClick={() => setActiveTab('interface')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'interface'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>界面与工具栏</span>
            </button>

            <button
              onClick={() => setActiveTab('webdav')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'webdav'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>WebDAV 云同步</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'backup'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>数据备份与安全</span>
            </button>

            <button
              onClick={() => setActiveTab('editing')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'editing'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>编辑偏好与默认</span>
            </button>

            <button
              onClick={() => setActiveTab('license')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'license'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs font-semibold'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Crown className="w-3.5 h-3.5" />
                <span>Pro 会员与特权</span>
              </div>
              {license.tier !== 'free' && (
                <span className="text-[9px] px-1 bg-white/20 rounded font-bold">PRO</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'about'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>关于与隐私</span>
            </button>
          </div>

          {/* Right Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700 dark:text-slate-300">
            {/* TAB 1: INTERFACE & TOOLBAR */}
            {activeTab === 'interface' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    工具栏位置定制
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    根据日常操作习惯选择工具栏停靠在窗口顶部还是底部：
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSaveSettings({ toolbarPosition: 'top' })}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        currentSettings.toolbarPosition === 'top'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        顶部置顶 (Top)
                      </span>
                      {currentSettings.toolbarPosition === 'top' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleSaveSettings({ toolbarPosition: 'bottom' })}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        currentSettings.toolbarPosition === 'bottom'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        底部置底 (Bottom)
                      </span>
                      {currentSettings.toolbarPosition === 'bottom' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    宏观工作台停靠位置
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSaveSettings({ workbenchDockPosition: 'left' })}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        currentSettings.workbenchDockPosition === 'left'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>左侧停靠 (Left)</span>
                      {currentSettings.workbenchDockPosition === 'left' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleSaveSettings({ workbenchDockPosition: 'right' })}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        currentSettings.workbenchDockPosition === 'right'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>右侧停靠 (Right)</span>
                      {currentSettings.workbenchDockPosition === 'right' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-1">
                    工具栏功能按钮定制
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    勾选希望常驻显示的工具栏按钮，在紧凑界面或侧边栏模式下可隐藏不常用项：
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'history', label: '撤销 / 重做' },
                      { key: 'insert', label: '新建子级 / 同级分支' },
                      { key: 'layout', label: '思维导图/逻辑/组织架构' },
                      { key: 'theme', label: '主题配色选择器' },
                      { key: 'outline', label: '大纲视图切换' },
                      { key: 'inbox', label: '灵感收集箱' },
                      { key: 'templates', label: '专业模板库' },
                      { key: 'zen', label: 'Zen 专注模式' },
                      { key: 'export', label: '导入 / 导出菜单' },
                      { key: 'zoom', label: '画布缩放控件' },
                    ].map((btn) => {
                      const isChecked = currentSettings.toolbarButtons[btn.key as keyof typeof currentSettings.toolbarButtons];
                      return (
                        <label
                          key={btn.key}
                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              handleSaveSettings({
                                toolbarButtons: {
                                  ...currentSettings.toolbarButtons,
                                  [btn.key]: e.target.checked,
                                },
                              });
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span className="text-[11px]">{btn.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    画布背景纹理
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dots', label: '点阵纹理 (Dots)' },
                      { id: 'grid', label: '方格纹理 (Grid)' },
                      { id: 'blank', label: '纯净无格 (Blank)' },
                    ].map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => handleSaveSettings({ canvasBackground: bg.id as any })}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          currentSettings.canvasBackground === bg.id
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WEBDAV CLOUD SYNC */}
            {activeTab === 'webdav' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      WebDAV 云端同步与灾备
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      支持坚果云、Nextcloud、群晖 Synology 等标准 WebDAV 网盘
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSettings.webdav.enabled}
                      onChange={(e) => handleWebDAVFieldChange('enabled', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-semibold">启用同步</span>
                  </label>
                </div>

                {/* Quick Presets */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    快捷预设服务商模板
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApplyPreset('jianguoyun')}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg text-[11px] font-medium"
                    >
                      坚果云 (Jianguoyun)
                    </button>
                    <button
                      onClick={() => handleApplyPreset('nextcloud')}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg text-[11px] font-medium"
                    >
                      Nextcloud / ownCloud
                    </button>
                    <button
                      onClick={() => handleApplyPreset('synology')}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg text-[11px] font-medium"
                    >
                      群晖 NAS (WebDAV Server)
                    </button>
                  </div>
                </div>

                {/* Config Form */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      WebDAV 服务器地址 (Server URL)
                    </label>
                    <input
                      type="text"
                      placeholder="https://dav.jianguoyun.com/dav/"
                      value={currentSettings.webdav.serverUrl}
                      onChange={(e) => handleWebDAVFieldChange('serverUrl', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        远端同步目录 (Remote Directory)
                      </label>
                      <input
                        type="text"
                        placeholder="/MindFlow/"
                        value={currentSettings.webdav.basePath}
                        onChange={(e) => handleWebDAVFieldChange('basePath', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        用户名 / 邮箱
                      </label>
                      <input
                        type="text"
                        placeholder="your-email@example.com"
                        value={currentSettings.webdav.username}
                        onChange={(e) => handleWebDAVFieldChange('username', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      密码 / 应用专属授权密码 (App Password)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="坚果云等请使用应用生成的专属密码"
                        value={currentSettings.webdav.password}
                        onChange={(e) => handleWebDAVFieldChange('password', e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={currentSettings.webdav.autoSyncOnSave}
                      onChange={(e) => handleWebDAVFieldChange('autoSyncOnSave', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px]">文档编辑保存时自动上传备份至云端 (Auto-Sync)</span>
                  </label>
                </div>

                {/* Test Feedback Notice */}
                {testResult && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {testResult.success ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>{testResult.message}</div>
                  </div>
                )}

                {/* Sync Notice */}
                {syncNotice && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2 ${
                      syncNotice.success
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {syncNotice.success ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>{syncNotice.message}</div>
                  </div>
                )}

                {/* WebDAV Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleTestWebDAV}
                    disabled={testingWebDAV}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {testingWebDAV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>测试连接</span>
                  </button>

                  <button
                    onClick={handleUploadToWebDAV}
                    disabled={syncingWebDAV || !currentSettings.webdav.serverUrl}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {syncingWebDAV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>立即备份上传</span>
                  </button>

                  <button
                    onClick={handleDownloadFromWebDAV}
                    disabled={syncingWebDAV || !currentSettings.webdav.serverUrl}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>从云端恢复导图</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: DATA BACKUP & SNAPSHOTS */}
            {activeTab === 'backup' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    版本快照策略
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">编辑时自动生成快照</div>
                        <div className="text-[10px] text-slate-400">在您专注创作时后台定时创建版本，防手误丢失</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentSettings.autoSnapshotEnabled}
                        onChange={(e) => handleSaveSettings({ autoSnapshotEnabled: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          自动快照间隔
                        </label>
                        <select
                          value={currentSettings.autoSnapshotIntervalMinutes}
                          onChange={(e) => handleSaveSettings({ autoSnapshotIntervalMinutes: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                        >
                          <option value={5}>每 5 分钟</option>
                          <option value={10}>每 10 分钟 (推荐)</option>
                          <option value={30}>每 30 分钟</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          单文档最多保留快照数
                        </label>
                        <select
                          value={currentSettings.maxSnapshotsPerDoc}
                          onChange={(e) => handleSaveSettings({ maxSnapshotsPerDoc: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                        >
                          <option value={10}>最近 10 个</option>
                          <option value={20}>最近 20 个 (标准)</option>
                          <option value={50}>最近 50 个 (大容量)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                {/* Storage Quota */}
                {quota && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                      本地存储配额
                    </h3>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 font-medium">
                          <HardDrive className="w-3.5 h-3.5 text-blue-500" /> 本机 Chrome 存储使用量
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatSize(quota.usedBytes)} / {formatSize(quota.maxBytes)} ({quota.percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(quota.percent, 3)}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Full Workspace Backup */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    全量工作区打包
                  </h3>
                  {backupNotice && (
                    <div className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{backupNotice}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExportLocalWorkspace}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" /> 导出全部导图与快照
                    </button>
                    <button
                      onClick={() => backupFileInputRef.current?.click()}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-600" /> 从文件还原工作区
                    </button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportLocalWorkspace}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: EDITING DEFAULTS */}
            {activeTab === 'editing' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    新建导图默认选项
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        默认配色主题
                      </label>
                      <select
                        value={currentSettings.defaultThemeId}
                        onChange={(e) => handleSaveSettings({ defaultThemeId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                      >
                        {Object.values(THEMES).map((th) => (
                          <option key={th.id} value={th.id}>{th.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        默认布局方式
                      </label>
                      <select
                        value={currentSettings.defaultLayout}
                        onChange={(e) => handleSaveSettings({ defaultLayout: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                      >
                        <option value="mindmap">左右平衡思维导图</option>
                        <option value="logic-right">向右逻辑结构图</option>
                        <option value="org-down">向下组织架构图</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                    节点与任务交互习惯
                  </h3>
                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">添加子节点时自动展开父节点</div>
                        <div className="text-[10px] text-slate-400">若父分支当前处于折叠状态，按 Tab 时将自动展开显示新子项</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentSettings.autoExpandOnAddChild}
                        onChange={(e) => handleSaveSettings({ autoExpandOnAddChild: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </label>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        新建任务时的默认优先级
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: 1, label: 'P1 高优先级 (红)' },
                          { val: 2, label: 'P2 中优先级 (橙)' },
                          { val: 3, label: 'P3 普通 (绿)' },
                        ].map((p) => (
                          <button
                            key={p.val}
                            onClick={() => handleSaveSettings({ defaultTaskPriority: p.val as any })}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              currentSettings.defaultTaskPriority === p.val
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PRO LICENSE & MONETIZATION */}
            {activeTab === 'license' && (
              <div className="space-y-4">
                {/* Pro Status Banner */}
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between ${
                    license.tier !== 'free'
                      ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30'
                      : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                        license.tier !== 'free'
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      <Crown className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {license.tier === 'enterprise'
                            ? 'MindFlow Enterprise 企业授权'
                            : license.tier === 'pro'
                            ? 'MindFlow Pro 专业版 (终身激活)'
                            : 'MindFlow 社区免费版'}
                        </h4>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                            license.tier !== 'free'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {license.tier !== 'free' ? 'PRO ACTIVE' : 'FREE TIER'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {license.tier !== 'free'
                          ? `授权对象: ${license.licensee || 'Individual'} • 永久享有所有后续商业功能升级`
                          : '当前正在使用基础版功能，升级可解锁全部 10 款主题、路演演示模式与无水印商业导出。'}
                      </p>
                    </div>
                  </div>

                  {license.tier !== 'free' && (
                    <button
                      onClick={handleDeactivate}
                      className="px-2.5 py-1 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
                    >
                      注销授权
                    </button>
                  )}
                </div>

                {/* Features Comparison Matrix */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 flex justify-between">
                    <span>版本特权权益对比</span>
                    <span>社区版 vs Pro 专业版</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[11px]">
                    {[
                      { name: '10 大全量专业主题 (赛博朋克/学术纸感/极夜等)', free: '基础 5 套', pro: '全部 10+ 套无限制' },
                      { name: '商业级路演演示模式 (Presentation Mode)', free: '不可用', pro: '全屏自适应演讲' },
                      { name: '无水印 4K PNG / 矢量 SVG 高清导出', free: '含 MindFlow 水印', pro: '纯净无水印' },
                      { name: '多版本历史快照备份 (Snapshots)', free: '限 10 份', pro: '无限快照留存' },
                      { name: 'WebDAV 实时增量云端自动同步', free: '手动同步', pro: '文档保存即刻同步' },
                      { name: '大型复杂导图子树下钻专注 (Focus Subtree)', free: '不可用', pro: '任意分支独立下钻' },
                    ].map((item, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-slate-400 text-right w-24">{item.free}</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold text-right w-28 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                            {item.pro}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* License Key Activation Section */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                      <Key className="w-4 h-4 text-amber-500" />
                      <span>输入序列号 / 激活码</span>
                    </div>
                    <button
                      onClick={handleGenerateTrialKey}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>获取测试体验激活码</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activationKey}
                      onChange={(e) => setActivationKey(e.target.value)}
                      placeholder="MFPRO-XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      onClick={handleActivate}
                      disabled={activating || !activationKey.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all shrink-0 flex items-center gap-1.5"
                    >
                      {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                      <span>立即激活</span>
                    </button>
                  </div>

                  {activateNotice && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        activateNotice.success
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      {activateNotice.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      )}
                      <span>{activateNotice.message}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400">
                    * 激活验证完全基于本地加密校验，100% 离线可用，无需将密钥回传至第三方网络服务器。
                  </p>
                </div>
              </div>
            )}

            {/* TAB 6: ABOUT & PRIVACY */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    MF
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">MindFlow 思维导图与伴读笔记</h3>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">版本 2.2.0 (Manifest V3 规范)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      基于 Chrome 浏览器的模块化、离线优先、全键盘盲操思维导图引擎。
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">🛡️ 本地优先与隐私原则</h4>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <li>所有思维导图、大纲、收集箱与版本快照严格保存在您个人的浏览器本地存储中。</li>
                    <li>无任何追踪脚本、无第三方数据收集。WebDAV 授权密码仅存于本机，直接与您的网盘建立点对点通信。</li>
                    <li>在离线状态下全部功能（包括作图、排版、导出图片与 Markdown）完美运行。</li>
                  </ul>
                </div>

                <div className="h-px bg-slate-200 dark:border-slate-800" />

                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">重置系统设置</h4>
                  <p className="text-[11px] text-slate-400 mb-2">恢复所有自定义工具栏、默认主题、布局与偏好为出厂状态（不会删除您的导图）：</p>
                  <button
                    onClick={handleResetAllSettings}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-200 dark:border-red-900/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>恢复出厂设置</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
