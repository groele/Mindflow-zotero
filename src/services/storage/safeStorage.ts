import { getZoteroInstance } from '../zotero/zoteroBridge';

/**
 * Universal Safe Storage Abstraction
 * Supports:
 * 1. Chrome Extension (chrome.storage.local)
 * 2. Zotero 7+ Client (Zotero.Prefs + in-memory store)
 * 3. Browser / Dev Server (localStorage with safe fallbacks)
 *
 * Guarantees zero uncaught exceptions when localStorage is blocked or throws SecurityError in Gecko.
 */

// Memory fallback store when localStorage or native storage is restricted
const memoryStore = new Map<string, string>();

let isLocalStorageAvailable = false;
try {
  if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
    const testKey = '__mindflow_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    isLocalStorageAvailable = true;
  }
} catch {
  isLocalStorageAvailable = false;
}

export const safeStorage = {
  isAvailable(): boolean {
    return isLocalStorageAvailable;
  },

  getItem(key: string): string | null {
    // 1. Try Zotero.Prefs if in Zotero
    const zotero = getZoteroInstance();
    if (zotero && zotero.Prefs) {
      try {
        const val = zotero.Prefs.get('mindflow.' + key, true);
        if (typeof val === 'string') return val;
      } catch {
        // ignore
      }
    }

    // 2. Try window.localStorage
    if (isLocalStorageAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // fallback
      }
    }

    // 3. Fallback to in-memory store
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    const strVal = typeof value === 'string' ? value : String(value);

    // Keep memoryStore updated
    memoryStore.set(key, strVal);

    // 1. Try Zotero.Prefs if in Zotero
    const zotero = getZoteroInstance();
    if (zotero && zotero.Prefs) {
      try {
        zotero.Prefs.set('mindflow.' + key, strVal, true);
      } catch {
        // ignore
      }
    }

    // 2. Try window.localStorage
    if (isLocalStorageAvailable) {
      try {
        window.localStorage.setItem(key, strVal);
      } catch {
        // ignore
      }
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);

    const zotero = getZoteroInstance();
    if (zotero && zotero.Prefs) {
      try {
        zotero.Prefs.clear('mindflow.' + key, true);
      } catch {
        // ignore
      }
    }

    if (isLocalStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  },

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};

    // First populate from localStorage if available
    if (isLocalStorageAvailable) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) {
            const v = window.localStorage.getItem(k);
            if (v !== null) result[k] = v;
          }
        }
      } catch {
        // ignore
      }
    }

    // Merge memory store
    for (const [k, v] of memoryStore.entries()) {
      result[k] = v;
    }

    return result;
  },

  getAllKeys(): string[] {
    return Object.keys(this.getAll());
  },

  clear(): void {
    memoryStore.clear();

    if (isLocalStorageAvailable) {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    }
  },
};
