import { MindMapDocument } from '../../core/model/types';
import { createDefaultDocument } from '../../core/model/sampleData';

const STORAGE_KEYS = {
  DOC_PREFIX: 'mindflow_doc_',
  DOC_INDEX: 'mindflow_docs_index',
  ACTIVE_DOC_ID: 'mindflow_active_doc_id',
};

// Check if chrome.storage is available
function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

// Storage wrapper
async function getItem(key: string): Promise<string | null> {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => {
        resolve((res[key] as string) || null);
      });
    });
  }
  return Promise.resolve(localStorage.getItem(key));
}

async function setItem(key: string, value: string): Promise<void> {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }
  localStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }
  localStorage.removeItem(key);
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: number;
  nodeCount?: number;
}

export class StorageService {
  public static async getActiveDocument(): Promise<MindMapDocument> {
    const activeId = await getItem(STORAGE_KEYS.ACTIVE_DOC_ID);
    if (activeId) {
      const doc = await this.getDocument(activeId);
      if (doc) return doc;
    }

    // If no active doc or not found, try to get the first one in index
    const index = await this.getDocumentList();
    if (index.length > 0) {
      const firstDoc = await this.getDocument(index[0].id);
      if (firstDoc) {
        await this.setActiveDocumentId(firstDoc.id);
        return firstDoc;
      }
    }

    // Otherwise create default document
    const defaultDoc = createDefaultDocument();
    await this.saveDocument(defaultDoc);
    await this.setActiveDocumentId(defaultDoc.id);
    return defaultDoc;
  }

  public static async setActiveDocumentId(id: string): Promise<void> {
    await setItem(STORAGE_KEYS.ACTIVE_DOC_ID, id);
  }

  public static async getDocument(id: string): Promise<MindMapDocument | null> {
    const raw = await getItem(STORAGE_KEYS.DOC_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MindMapDocument;
    } catch {
      return null;
    }
  }

  public static async saveDocument(doc: MindMapDocument): Promise<void> {
    doc.updatedAt = Date.now();
    await setItem(STORAGE_KEYS.DOC_PREFIX + doc.id, JSON.stringify(doc));

    // Update index
    const index = await this.getDocumentList();
    const existingIdx = index.findIndex(item => item.id === doc.id);
    const summary: DocumentSummary = {
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    };

    if (existingIdx >= 0) {
      index[existingIdx] = summary;
    } else {
      index.unshift(summary);
    }

    await setItem(STORAGE_KEYS.DOC_INDEX, JSON.stringify(index));
  }

  public static async getDocumentList(): Promise<DocumentSummary[]> {
    const raw = await getItem(STORAGE_KEYS.DOC_INDEX);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DocumentSummary[];
    } catch {
      return [];
    }
  }

  public static async deleteDocument(id: string): Promise<void> {
    await removeItem(STORAGE_KEYS.DOC_PREFIX + id);
    let index = await this.getDocumentList();
    index = index.filter(item => item.id !== id);
    await setItem(STORAGE_KEYS.DOC_INDEX, JSON.stringify(index));
  }
}
