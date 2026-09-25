import { InboxItem } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';

const INBOX_STORAGE_KEY = 'mindflow_inbox_items';

function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

export class InboxService {
  public static async getItems(): Promise<InboxItem[]> {
    if (isChromeStorage()) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([INBOX_STORAGE_KEY], (res) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '读取收集箱失败'));
            return;
          }
          const raw = res[INBOX_STORAGE_KEY];
          if (!raw) return resolve([]);
          try {
            const parsed = JSON.parse(raw as string);
            if (!Array.isArray(parsed)) throw new Error('收集箱数据不是列表');
            resolve(parsed);
          } catch (error) {
            reject(new Error(`收集箱数据损坏：${(error as Error).message}`));
          }
        });
      });
    }

    const raw = localStorage.getItem(INBOX_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('收集箱数据不是列表');
      return parsed;
    } catch (error) {
      throw new Error(`收集箱数据损坏：${(error as Error).message}`);
    }
  }

  public static async addItem(text: string, title?: string, url?: string, favIconUrl?: string): Promise<InboxItem> {
    const items = await this.getItems();
    const newItem: InboxItem = {
      id: 'inbox_' + generateId(),
      text: text.trim(),
      title: title?.trim(),
      url: url?.trim(),
      favIconUrl,
      createdAt: Date.now(),
      isProcessed: false,
    };

    items.unshift(newItem);
    await this.saveItems(items);
    return newItem;
  }

  public static async deleteItem(id: string): Promise<void> {
    let items = await this.getItems();
    items = items.filter(i => i.id !== id);
    await this.saveItems(items);
  }

  public static async markProcessed(id: string, isProcessed = true): Promise<void> {
    const items = await this.getItems();
    const target = items.find(i => i.id === id);
    if (target) {
      target.isProcessed = isProcessed;
      await this.saveItems(items);
    }
  }

  public static async clearProcessed(): Promise<void> {
    let items = await this.getItems();
    items = items.filter(i => !i.isProcessed);
    await this.saveItems(items);
  }

  private static async saveItems(items: InboxItem[]): Promise<void> {
    const serialized = JSON.stringify(items);
    if (isChromeStorage()) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [INBOX_STORAGE_KEY]: serialized }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '保存收集箱失败'));
            return;
          }
          resolve();
        });
      });
    }
    localStorage.setItem(INBOX_STORAGE_KEY, serialized);
  }
}
