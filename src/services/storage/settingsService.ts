import { AppSettings, DEFAULT_SETTINGS } from '../../core/model/settingsTypes';
import { safeStorage } from './safeStorage';
import { getZoteroInstance } from '../zotero/zoteroBridge';

const SETTINGS_STORAGE_KEY = 'mindflow_app_settings';

const ZOTERO_PREF_PATHS: Record<string, string> = {
  zoteroWindowMode: 'windowMode',
  showWelcomeOnStartup: 'showWelcomeOnStartup',
  zoteroIncludeAbstract: 'includeAbstract',
  zoteroIncludeAnnotations: 'includeAnnotations',
  zoteroIncludeTags: 'includeTags',
  defaultLayout: 'defaultLayout',
  canvasBackground: 'canvasBackground',
  curveStyle: 'curveStyle',
  rainbowBranches: 'rainbowBranches',
  soundEffects: 'soundEffects',
  autoSnapshotEnabled: 'autoSnapshotEnabled',
  autoSnapshotIntervalMinutes: 'autoSnapshotIntervalMinutes',
  'webdav.enabled': 'webdavEnabled',
  'webdav.serverUrl': 'webdavServerUrl',
  'webdav.basePath': 'webdavBasePath',
  'webdav.username': 'webdavUsername',
  'webdav.password': 'webdavPassword',
  'webdav.autoSyncOnSave': 'webdavAutoSync',
};

function getPath(value: any, path: string): any {
  return path.split('.').reduce((current, part) => current?.[part], value);
}

function setPath(value: any, path: string, next: any): void {
  const parts = path.split('.');
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts[parts.length - 1]] = next;
}

function legacyZoteroSettings(): Partial<AppSettings> {
  const zotero = getZoteroInstance();
  const migrated = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
  if (!zotero?.Prefs) return migrated;
  for (const [path, pref] of Object.entries(ZOTERO_PREF_PATHS)) {
    const value = zotero.Prefs.get('extensions.mindflow.' + pref, true);
    if (value !== undefined && value !== null) setPath(migrated, path, value);
  }
  const theme = zotero.Prefs.get('extensions.mindflow.theme', true);
  if (typeof theme === 'string' && [
    'classic-blue', 'dark-nebula', 'macaron', 'forest-green', 'minimal-ink',
    'warm-amber', 'cyberpunk-neon', 'nordic-frost', 'academic-paper', 'lavender-dream',
  ].includes(theme)) migrated.defaultThemeId = theme;
  return migrated;
}

function mirrorZoteroPreferences(settings: AppSettings): void {
  const zotero = getZoteroInstance();
  if (!zotero?.Prefs) return;
  for (const [path, pref] of Object.entries(ZOTERO_PREF_PATHS)) {
    zotero.Prefs.set('extensions.mindflow.' + pref, getPath(settings, path), true);
  }
  zotero.Prefs.set('extensions.mindflow.theme', settings.defaultThemeId, true);
}

function isChromeStorage(): boolean {
  return !getZoteroInstance() && typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

function deepMerge(target: any, source: any): any {
  if (!source) return target;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

export class SettingsService {
  private static cachedSettings: AppSettings | null = null;

  /**
   * Load settings from storage, merged with defaults
   */
  public static async getSettings(): Promise<AppSettings> {
    if (this.cachedSettings && !getZoteroInstance()) {
      return { ...this.cachedSettings };
    }

    let loadedSettings: Partial<AppSettings> | null = null;

    if (isChromeStorage()) {
      loadedSettings = await new Promise((resolve, reject) => {
        chrome.storage.local.get([SETTINGS_STORAGE_KEY], (res) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '读取设置失败'));
            return;
          }
          const raw = res[SETTINGS_STORAGE_KEY];
          if (!raw) return resolve(null);
          try {
            resolve(typeof raw === 'string' ? JSON.parse(raw) : raw);
          } catch {
            resolve(null);
          }
        });
      });
    } else {
      const raw = safeStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        try {
          loadedSettings = JSON.parse(raw);
        } catch {
          loadedSettings = null;
        }
      }
    }

    const merged = deepMerge(DEFAULT_SETTINGS,
      loadedSettings || (getZoteroInstance() ? legacyZoteroSettings() : {}));
    this.cachedSettings = merged;
    return { ...merged };
  }

  /**
   * Update and persist partial settings
   */
  public static async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = deepMerge(current, partial);

    if (isChromeStorage()) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '保存设置失败'));
            return;
          }
          resolve();
        });
      });
    } else {
      safeStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    }
    this.cachedSettings = updated;
    mirrorZoteroPreferences(updated);

    // Also synchronize workbenchDockPosition to safeStorage key for compatibility
    if (partial.workbenchDockPosition) {
      safeStorage.setItem('mindflow_dock_pos', partial.workbenchDockPosition);
    }

    return { ...updated };
  }

  /**
   * Reset settings to default values
   */
  public static async resetSettings(): Promise<AppSettings> {
    if (isChromeStorage()) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '重置设置失败'));
            return;
          }
          resolve();
        });
      });
    } else {
      safeStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }

    this.cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
    mirrorZoteroPreferences(DEFAULT_SETTINGS);
    safeStorage.setItem('mindflow_dock_pos', DEFAULT_SETTINGS.workbenchDockPosition);
    return { ...DEFAULT_SETTINGS };
  }
}
