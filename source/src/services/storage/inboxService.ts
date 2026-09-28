import { InboxItem } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';
import { safeStorage } from './safeStorage';

const INBOX_STORAGE_KEY = 'mindflow_inbox_items';

export class InboxService {
  public static async getItems(): Promise<InboxItem[]> {
    const raw = safeStorage.getItem(INBOX_STORAGE_KEY);
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
    safeStorage.setItem(INBOX_STORAGE_KEY, serialized);
  }
}
