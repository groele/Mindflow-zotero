import { AppSettings, DEFAULT_SETTINGS } from '../../core/model/settingsTypes';

const SETTINGS_STORAGE_KEY = 'mindflow_app_settings';

function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
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
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    let loadedSettings: Partial<AppSettings> | null = null;

    if (isChromeStorage()) {
      loadedSettings = await new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_STORAGE_KEY], (res) => {
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
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        try {
          loadedSettings = JSON.parse(raw);
        } catch {
          loadedSettings = null;
        }
      }
    }

    const merged = deepMerge(DEFAULT_SETTINGS, loadedSettings || {});
    this.cachedSettings = merged;
    return { ...merged };
  }

  /**
   * Update and persist partial settings
   */
  public static async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = deepMerge(current, partial);
    this.cachedSettings = updated;

    if (isChromeStorage()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated }, () => resolve());
      });
    } else {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    }

    // Also synchronize workbenchDockPosition to localStorage key for compatibility
    if (partial.workbenchDockPosition) {
      localStorage.setItem('mindflow_dock_pos', partial.workbenchDockPosition);
    }

    return { ...updated };
  }

  /**
   * Reset settings to default values
   */
  public static async resetSettings(): Promise<AppSettings> {
    this.cachedSettings = { ...DEFAULT_SETTINGS };

    if (isChromeStorage()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS }, () => resolve());
      });
    } else {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }

    localStorage.setItem('mindflow_dock_pos', DEFAULT_SETTINGS.workbenchDockPosition);
    return { ...DEFAULT_SETTINGS };
  }
}
