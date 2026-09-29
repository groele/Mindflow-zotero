import { InboxItem } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';
import { safeStorage } from './safeStorage';
import { isZoteroWorkspace, zoteroWorkspaceStorage } from '../zotero/zoteroBridge';

const INBOX_STORAGE_KEY = 'mindflow_inbox_items';

export function validateInboxItems(value: unknown): InboxItem[] {
  if (!Array.isArray(value)) throw new Error('收集箱数据不是列表');
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id ||
        typeof item.text !== 'string' || !Number.isFinite(item.createdAt) || typeof item.isProcessed !== 'boolean' ||
        ['title', 'url', 'favIconUrl'].some(key => item[key] !== undefined && typeof item[key] !== 'string')) {
      throw new Error('收集箱包含格式无效的记录');
    }
    if (ids.has(item.id)) throw new Error('收集箱包含重复的记录 ID');
    ids.add(item.id);
  }
  return value;
}

export class InboxService {
  private static mutationQueue: Promise<unknown> = Promise.resolve();

  public static async getItems(): Promise<InboxItem[]> {
    const raw = isZoteroWorkspace()
      ? await zoteroWorkspaceStorage('get', { key: INBOX_STORAGE_KEY }) : safeStorage.getItem(INBOX_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return validateInboxItems(parsed);
    } catch (error) {
      throw new Error(`收集箱数据损坏：${(error as Error).message}`);
    }
  }

  public static async addItem(text: string, title?: string, url?: string, favIconUrl?: string): Promise<InboxItem> {
    if (!text.trim()) throw new Error('收集箱内容不能为空');
    const newItem: InboxItem = {
      id: 'inbox_' + generateId(),
      text: text.trim(),
      title: title?.trim(),
      url: url?.trim(),
      favIconUrl,
      createdAt: Date.now(),
      isProcessed: false,
    };

    await this.mutate({ additions: [newItem] });
    return newItem;
  }

  public static async deleteItem(id: string): Promise<void> {
    await this.mutate({ removeId: id });
  }

  public static async markProcessed(id: string, isProcessed = true): Promise<void> {
    await this.mutate({ processedId: id, isProcessed });
  }

  public static async clearProcessed(): Promise<void> {
    await this.mutate({ clearProcessed: true });
  }

  public static async mergeItems(items: InboxItem[]): Promise<void> {
    await this.mutate({ additions: validateInboxItems(items) });
  }

  private static async mutate(payload: { additions?: InboxItem[]; removeId?: string; processedId?: string; isProcessed?: boolean; clearProcessed?: boolean }): Promise<void> {
    if (isZoteroWorkspace()) { await zoteroWorkspaceStorage('mutateInbox', payload); return; }
    const operation = this.mutationQueue.then(async () => {
      let items = await this.getItems();
      items = items.filter(item => item.id !== payload.removeId && !(payload.clearProcessed && item.isProcessed));
      if (payload.processedId) items = items.map(item => item.id === payload.processedId ? { ...item, isProcessed: payload.isProcessed === true } : item);
      const ids = new Set(items.map(item => item.id));
      for (const item of payload.additions || []) {
        if (!ids.has(item.id)) { items.unshift(item); ids.add(item.id); }
      }
      safeStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(validateInboxItems(items)));
    });
    this.mutationQueue = operation.catch(() => undefined);
    await operation;
  }
}
