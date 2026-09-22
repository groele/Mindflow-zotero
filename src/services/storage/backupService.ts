import { MindMapDocument, InboxItem } from '../../core/model/types';
import { StorageService } from './storageService';
import { InboxService } from './inboxService';
import { generateId } from '../../core/model/treeOps';

export interface DocSnapshot {
  id: string;
  docId: string;
  title: string;
  timestamp: number;
  nodeCount: number;
  data: string; // JSON stringified document
}

export interface WorkspaceBackupData {
  version: string;
  exportedAt: number;
  documents: MindMapDocument[];
  inboxItems: InboxItem[];
  snapshots: DocSnapshot[];
}

export interface StorageQuotaInfo {
  usedBytes: number;
  maxBytes: number;
  percent: number;
}

const SNAPSHOT_STORAGE_KEY = 'mindflow_snapshots_';
const MAX_SNAPSHOTS_PER_DOC = 20;

function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

function countNodes(root: any): number {
  if (!root) return 0;
  let count = 1;
  if (root.children && Array.isArray(root.children)) {
    for (const c of root.children) {
      count += countNodes(c);
    }
  }
  return count;
}

export class BackupService {
  // 1. Create a version snapshot for a document
  public static async createSnapshot(doc: MindMapDocument): Promise<DocSnapshot> {
    const snapshots = await this.getSnapshots(doc.id);
    const nodeCount = countNodes(doc.root);

    const newSnapshot: DocSnapshot = {
      id: 'snap_' + generateId(),
      docId: doc.id,
      title: doc.title,
      timestamp: Date.now(),
      nodeCount,
      data: JSON.stringify(doc),
    };

    // Keep at most MAX_SNAPSHOTS_PER_DOC
    snapshots.unshift(newSnapshot);
    if (snapshots.length > MAX_SNAPSHOTS_PER_DOC) {
      snapshots.splice(MAX_SNAPSHOTS_PER_DOC);
    }

    await this.saveSnapshots(doc.id, snapshots);
    return newSnapshot;
  }

  // 2. Get snapshots for a document
  public static async getSnapshots(docId: string): Promise<DocSnapshot[]> {
    const key = SNAPSHOT_STORAGE_KEY + docId;
    if (isChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (res) => {
          const raw = res[key];
          if (!raw) return resolve([]);
          try {
            resolve(JSON.parse(raw as string));
          } catch {
            resolve([]);
          }
        });
      });
    }

    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  // 3. Restore document from a snapshot
  public static async restoreSnapshot(docId: string, snapshotId: string): Promise<MindMapDocument | null> {
    const snapshots = await this.getSnapshots(docId);
    const target = snapshots.find(s => s.id === snapshotId);
    if (!target) return null;

    try {
      const doc = JSON.parse(target.data) as MindMapDocument;
      doc.updatedAt = Date.now();
      await StorageService.saveDocument(doc);
      return doc;
    } catch {
      return null;
    }
  }

  // 4. Delete a snapshot
  public static async deleteSnapshot(docId: string, snapshotId: string): Promise<void> {
    let snapshots = await this.getSnapshots(docId);
    snapshots = snapshots.filter(s => s.id !== snapshotId);
    await this.saveSnapshots(docId, snapshots);
  }

  // 5a. Generate full workspace data structure
  public static async getFullWorkspaceData(): Promise<WorkspaceBackupData> {
    const docSummaries = await StorageService.getDocumentList();
    const documents: MindMapDocument[] = [];
    const allSnapshots: DocSnapshot[] = [];

    for (const sum of docSummaries) {
      const doc = await StorageService.getDocument(sum.id);
      if (doc) {
        documents.push(doc);
        const snaps = await this.getSnapshots(doc.id);
        allSnapshots.push(...snaps);
      }
    }

    const inboxItems = await InboxService.getItems();

    return {
      version: '1.2.0',
      exportedAt: Date.now(),
      documents,
      inboxItems,
      snapshots: allSnapshots,
    };
  }

  // 5b. Full workspace export (all documents, inbox, and snapshots download)
  public static async exportFullWorkspaceBackup(): Promise<void> {
    const backupData = await this.getFullWorkspaceData();
    const serialized = JSON.stringify(backupData, null, 2);
    const blob = new Blob([serialized], { type: 'application/json;charset=utf-8;' });
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `MindFlow_Workspace_Backup_${dateStr}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 6a. Import from WorkspaceBackupData object
  public static async importFullWorkspaceData(data: WorkspaceBackupData): Promise<{ docCount: number; inboxCount: number }> {
    if (!data.documents || !Array.isArray(data.documents)) {
      throw new Error('无效的 MindFlow 备份文件结构');
    }

    // Save all documents
    for (const doc of data.documents) {
      await StorageService.saveDocument(doc);
    }

    // Save inbox items
    if (data.inboxItems && Array.isArray(data.inboxItems)) {
      const currentInbox = await InboxService.getItems();
      const existingIds = new Set(currentInbox.map(i => i.id));
      for (const item of data.inboxItems) {
        if (!existingIds.has(item.id)) {
          currentInbox.push(item);
        }
      }
      // Save merged inbox
      const serialized = JSON.stringify(currentInbox);
      if (isChromeStorage()) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ mindflow_inbox_items: serialized }, () => resolve());
        });
      } else {
        localStorage.setItem('mindflow_inbox_items', serialized);
      }
    }

    // Restore snapshots
    if (data.snapshots && Array.isArray(data.snapshots)) {
      for (const snap of data.snapshots) {
        const snaps = await this.getSnapshots(snap.docId);
        if (!snaps.some(s => s.id === snap.id)) {
          snaps.push(snap);
          await this.saveSnapshots(snap.docId, snaps);
        }
      }
    }

    return {
      docCount: data.documents.length,
      inboxCount: data.inboxItems?.length || 0,
    };
  }

  // 6b. Full workspace import from JSON string
  public static async importFullWorkspaceBackup(jsonContent: string): Promise<{ docCount: number; inboxCount: number }> {
    const data = JSON.parse(jsonContent) as WorkspaceBackupData;
    return this.importFullWorkspaceData(data);
  }

  // 7. Get approximate storage quota
  public static async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (isChromeStorage() && chrome.storage.local.getBytesInUse) {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
          const maxBytes = 10 * 1024 * 1024; // 10MB default for chrome.storage.local
          resolve({
            usedBytes: bytesInUse || 0,
            maxBytes,
            percent: Math.min(100, Math.round(((bytesInUse || 0) / maxBytes) * 100)),
          });
        });
      });
    }

    // Fallback for localStorage estimation
    let totalLength = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalLength += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
    const usedBytes = totalLength * 2; // UTF-16 characters are 2 bytes
    const maxBytes = 5 * 1024 * 1024; // 5MB standard for localStorage
    return {
      usedBytes,
      maxBytes,
      percent: Math.min(100, Math.round((usedBytes / maxBytes) * 100)),
    };
  }

  private static async saveSnapshots(docId: string, snapshots: DocSnapshot[]): Promise<void> {
    const key = SNAPSHOT_STORAGE_KEY + docId;
    const serialized = JSON.stringify(snapshots);
    if (isChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: serialized }, () => resolve());
      });
    }
    localStorage.setItem(key, serialized);
  }
}
