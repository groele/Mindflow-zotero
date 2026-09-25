import { MindMapDocument } from '../../core/model/types';
import { createDefaultDocument } from '../../core/model/sampleData';

const STORAGE_KEYS = {
  DOC_PREFIX: 'mindflow_doc_',
  DELETED_PREFIX: 'mindflow_deleted_doc_',
  DOC_INDEX: 'mindflow_docs_index',
  ACTIVE_DOC_ID: 'mindflow_active_doc_id',
};

import { safeStorage } from './safeStorage';

// Check if chrome.storage is available
function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

// Storage wrapper
async function getItem(key: string): Promise<string | null> {
  if (isChromeStorage()) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (res) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message || '读取本地数据失败'));
          return;
        }
        resolve((res[key] as string) || null);
      });
    });
  }
  return Promise.resolve(safeStorage.getItem(key));
}

async function setItem(key: string, value: string): Promise<void> {
  return setItems({ [key]: value });
}

async function setItems(items: Record<string, unknown>): Promise<void> {
  if (isChromeStorage()) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message || '保存本地数据失败'));
          return;
        }
        resolve();
      });
    });
  }
  for (const [key, value] of Object.entries(items)) {
    safeStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

async function removeItem(key: string): Promise<void> {
  if (isChromeStorage()) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message || '删除本地数据失败'));
          return;
        }
        resolve();
      });
    });
  }
  safeStorage.removeItem(key);
}

async function getAllItems(): Promise<Record<string, unknown>> {
  if (isChromeStorage()) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message || '读取本地数据失败'));
          return;
        }
        resolve(items);
      });
    });
  }

  return safeStorage.getAll();
}

function isDocumentSummary(value: unknown): value is DocumentSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Partial<DocumentSummary>;
  return typeof summary.id === 'string' && typeof summary.title === 'string' && Number.isFinite(summary.updatedAt);
}

function isStoredDocument(value: unknown): value is MindMapDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<MindMapDocument>;
  return Boolean(
    typeof doc.id === 'string' && doc.id &&
    typeof doc.title === 'string' &&
    doc.root && typeof doc.root === 'object' &&
    typeof doc.root.id === 'string' &&
    typeof doc.root.text === 'string' &&
    Array.isArray(doc.root.children)
  );
}

function revisionOf(doc: MindMapDocument | null): number {
  return doc && Number.isSafeInteger(doc.revision) && (doc.revision as number) >= 0 ? doc.revision as number : 0;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: number;
  nodeCount?: number;
}

export class StorageService {
  private static knownRevisions = new Map<string, number>();
  private static writeQueue: Promise<unknown> = Promise.resolve();

  public static async getActiveDocument(): Promise<MindMapDocument> {
    const activeId = await getItem(STORAGE_KEYS.ACTIVE_DOC_ID);
    if (activeId) {
      if (activeId === 'doc_welcome_default') {
        await this.deleteDocument('doc_welcome_default');
      } else {
        const doc = await this.getDocument(activeId);
        if (doc && doc.id !== 'doc_welcome_default') return doc;
      }
    }

    // If no active doc or not found, try to get the first valid one in index
    const index = await this.getDocumentList();
    const validItems = index.filter((item) => item.id !== 'doc_welcome_default');
    if (validItems.length > 0) {
      const firstDoc = await this.getDocument(validItems[0].id);
      if (firstDoc) {
        await this.setActiveDocumentId(firstDoc.id);
        return firstDoc;
      }
    }

    // Otherwise create default clean blank document
    const defaultDoc = createDefaultDocument();
    await this.saveDocument(defaultDoc);
    await this.setActiveDocumentId(defaultDoc.id);
    return defaultDoc;
  }

  public static async setActiveDocumentId(id: string): Promise<void> {
    await setItem(STORAGE_KEYS.ACTIVE_DOC_ID, id);
  }

  public static async getDocument(id: string, options: { trackRevision?: boolean } = {}): Promise<MindMapDocument | null> {
    const raw = await getItem(STORAGE_KEYS.DOC_PREFIX + id);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isStoredDocument(parsed)) return null;
    if (options.trackRevision !== false) this.knownRevisions.set(id, revisionOf(parsed));
    return parsed;
  }

  public static async saveDocument(doc: MindMapDocument, options: { force?: boolean } = {}): Promise<MindMapDocument> {
    const expectedRevision = this.knownRevisions.get(doc.id) ?? revisionOf(doc);
    let saved: MindMapDocument;
    if (isChromeStorage() && typeof window !== 'undefined') {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_DOCUMENT', doc, expectedRevision, force: options.force === true,
      }) as { success: boolean; doc?: MindMapDocument; error?: string; conflict?: boolean };
      if (!response?.success || !response.doc) {
        if (response?.conflict) throw new DocumentConflictError(response.error || '其他窗口已修改此导图');
        throw new Error(response?.error || '保存导图失败');
      }
      saved = response.doc;
    } else {
      saved = await this.saveDocumentDirect(doc, expectedRevision, options.force === true);
    }
    this.knownRevisions.set(doc.id, revisionOf(saved));
    return saved;
  }

  /** Called by the extension service worker; the queue serializes all document writes. */
  public static saveDocumentDirect(doc: MindMapDocument, expectedRevision: number, force = false): Promise<MindMapDocument> {
    const operation = this.writeQueue.then(() => this.writeDocumentNow(doc, expectedRevision, force));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  private static async writeDocumentNow(doc: MindMapDocument, expectedRevision: number, force: boolean): Promise<MindMapDocument> {
    const current = await this.getDocument(doc.id);
    const currentRevision = revisionOf(current);
    if (!current && !force && await getItem(STORAGE_KEYS.DELETED_PREFIX + doc.id)) {
      throw new DocumentConflictError('此导图已在其他窗口删除；请保留为新导图或从备份恢复');
    }
    if (!force && currentRevision !== expectedRevision) {
      throw new DocumentConflictError(`导图已被其他窗口修改（当前版本 ${currentRevision}，本窗口版本 ${expectedRevision}）`);
    }
    const savedDoc = { ...doc, revision: currentRevision + 1, updatedAt: Date.now() };
    const index = await this.getDocumentList();
    const existingIdx = index.findIndex(item => item.id === savedDoc.id);
    const summary: DocumentSummary = {
      id: savedDoc.id,
      title: savedDoc.title,
      updatedAt: savedDoc.updatedAt,
    };

    if (existingIdx >= 0) {
      index[existingIdx] = summary;
    } else {
      index.unshift(summary);
    }

    // A single Chrome Storage write prevents the document and its index entry
    // from diverging when quota or I/O errors occur between separate writes.
    await setItems({
      [STORAGE_KEYS.DOC_PREFIX + savedDoc.id]: JSON.stringify(savedDoc),
      [STORAGE_KEYS.DOC_INDEX]: JSON.stringify(index),
    });
    this.knownRevisions.set(doc.id, savedDoc.revision);
    return savedDoc;
  }

  public static async getDocumentList(): Promise<DocumentSummary[]> {
    const raw = await getItem(STORAGE_KEYS.DOC_INDEX);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isDocumentSummary);
        if (valid.length > 0) {
          // Check for missing keys without parsing map contents. Keep corrupted
          // records discoverable instead of silently dropping their index rows.
          const existing = (await Promise.all(valid.map(async (summary) => (
            await getItem(STORAGE_KEYS.DOC_PREFIX + summary.id) !== null ? summary : null
          )))).filter((summary): summary is DocumentSummary => summary !== null);
          if (existing.length === valid.length) return existing;
          await setItem(STORAGE_KEYS.DOC_INDEX, JSON.stringify(existing));
          return existing;
        }
      }
    }

    const allItems = await getAllItems();
    const rebuilt: DocumentSummary[] = [];
    for (const [key, value] of Object.entries(allItems)) {
      if (!key.startsWith(STORAGE_KEYS.DOC_PREFIX) || typeof value !== 'string') continue;
      try {
        const parsed: unknown = JSON.parse(value);
        if (!isStoredDocument(parsed)) continue;
        rebuilt.push({
          id: parsed.id,
          title: parsed.title,
          updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
        });
      } catch {
        // Ignore only the unreadable record; keep other recoverable documents.
      }
    }
    rebuilt.sort((a, b) => b.updatedAt - a.updatedAt);
    await setItem(STORAGE_KEYS.DOC_INDEX, JSON.stringify(rebuilt));
    return rebuilt;
  }

  public static async deleteDocument(id: string): Promise<void> {
    const current = await this.getDocument(id, { trackRevision: false });
    if (!current) return;
    const expectedRevision = revisionOf(current);
    if (isChromeStorage() && typeof window !== 'undefined') {
      const response = await chrome.runtime.sendMessage({ type: 'DELETE_DOCUMENT', id, expectedRevision }) as { success?: boolean; error?: string; conflict?: boolean };
      if (!response?.success) {
        if (response?.conflict) throw new DocumentConflictError(response.error || '其他窗口已修改此导图');
        throw new Error(response?.error || '删除导图失败');
      }
    } else {
      await this.deleteDocumentDirect(id, expectedRevision);
    }
    this.knownRevisions.delete(id);
  }

  public static deleteDocumentDirect(id: string, expectedRevision: number): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const current = await this.getDocument(id, { trackRevision: false });
      if (!current || revisionOf(current) !== expectedRevision) throw new DocumentConflictError('导图已被其他窗口修改或删除，请刷新列表后重试');
      const index = (await this.getDocumentList()).filter(item => item.id !== id);
      await setItem(STORAGE_KEYS.DELETED_PREFIX + id, String(Date.now()));
      await removeItem(STORAGE_KEYS.DOC_PREFIX + id);
      await setItem(STORAGE_KEYS.DOC_INDEX, JSON.stringify(index));
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }
}

export class DocumentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentConflictError';
  }
}
