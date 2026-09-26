import { MindMapDocument, InboxItem } from '../../core/model/types';
import { StorageService } from './storageService';
import { InboxService } from './inboxService';
import { generateId } from '../../core/model/treeOps';
import { SettingsService } from './settingsService';
import { isSafeNodeImage } from '../../core/model/nodeImage';
import { safeStorage } from './safeStorage';

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

export interface WorkspaceRestorePreview {
  documents: number;
  replacing: string[];
  adding: string[];
  inboxItems: number;
  snapshots: number;
}

const SNAPSHOT_STORAGE_KEY = 'mindflow_snapshots_';
const DEFAULT_MAX_SNAPSHOTS_PER_DOC = 20;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_NODES_PER_DOCUMENT = 25000;
const MAX_NODE_DEPTH = 256;

function isChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

function countNodes(root: any): number {
  if (!root) return 0;
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    count += 1;
    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child);
    }
  }
  return count;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function validateMindMapDocument(value: unknown, label = '导图'): MindMapDocument {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.title !== 'string' ||
      typeof value.themeId !== 'string' ||
      !['mindmap', 'logic-right', 'org-down'].includes(String(value.layoutType)) ||
      !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt) ||
      (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0)) ||
      !isRecord(value.root)) {
    throw new Error(`${label}缺少有效的导图标题、ID 或根节点`);
  }

  const seenNodeIds = new Set<string>();
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value.root, depth: 0 }];
  let nodeCount = 0;
  while (stack.length > 0) {
    const entry = stack.pop()!;
    if (entry.depth > MAX_NODE_DEPTH) throw new Error(`${label}的节点层级过深，无法安全导入`);
    if (!isRecord(entry.node) || typeof entry.node.id !== 'string' || !entry.node.id ||
        typeof entry.node.text !== 'string' || !Array.isArray(entry.node.children)) {
      throw new Error(`${label}包含格式无效的节点`);
    }
    if ((entry.node.note !== undefined && typeof entry.node.note !== 'string') ||
        (entry.node.link !== undefined && typeof entry.node.link !== 'string') ||
        (entry.node.tags !== undefined && (!Array.isArray(entry.node.tags) || !entry.node.tags.every(tag => typeof tag === 'string'))) ||
        (entry.node.icons !== undefined && (!Array.isArray(entry.node.icons) || !entry.node.icons.every(icon => typeof icon === 'string')))) {
      throw new Error(`${label}包含格式无效的节点属性`);
    }
    if (entry.node.internalLink !== undefined &&
        (!isRecord(entry.node.internalLink) || typeof entry.node.internalLink.documentId !== 'string' || !entry.node.internalLink.documentId ||
          (entry.node.internalLink.nodeId !== undefined && typeof entry.node.internalLink.nodeId !== 'string'))) {
      throw new Error(`${label}包含格式无效的跨导图链接`);
    }
    if (entry.node.image !== undefined && !isSafeNodeImage(entry.node.image)) {
      throw new Error(`${label}包含格式或尺寸无效的节点图片`);
    }
    if (entry.node.task !== undefined) {
      if (!isRecord(entry.node.task) || !['todo', 'doing', 'done'].includes(String(entry.node.task.status)) ||
          (entry.node.task.priority !== undefined && ![1, 2, 3].includes(entry.node.task.priority as number)) ||
          (entry.node.task.dueDate !== undefined && (typeof entry.node.task.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.node.task.dueDate))) ||
          (entry.node.task.progress !== undefined && (typeof entry.node.task.progress !== 'number' || !Number.isFinite(entry.node.task.progress) || entry.node.task.progress < 0 || entry.node.task.progress > 100))) {
        throw new Error(`${label}包含格式无效的任务属性`);
      }
    }
    if (seenNodeIds.has(entry.node.id)) throw new Error(`${label}包含重复的节点 ID`);
    seenNodeIds.add(entry.node.id);
    nodeCount += 1;
    if (nodeCount > MAX_NODES_PER_DOCUMENT) throw new Error(`${label}节点过多，已超过安全导入上限`);
    for (const child of entry.node.children) {
      stack.push({ node: child, depth: entry.depth + 1 });
    }
  }

  if (value.relationships !== undefined) {
    if (!Array.isArray(value.relationships)) throw new Error(`${label}的关系线数据格式无效`);
    for (const relationship of value.relationships) {
      if (!isRecord(relationship) || typeof relationship.id !== 'string' ||
          typeof relationship.fromId !== 'string' || typeof relationship.toId !== 'string' ||
          !seenNodeIds.has(relationship.fromId) || !seenNodeIds.has(relationship.toId)) {
        throw new Error(`${label}包含指向不存在节点的关系线`);
      }
    }
  }

  return value as unknown as MindMapDocument;
}

function validateWorkspaceData(value: unknown): WorkspaceBackupData {
  if (!isRecord(value) || !Array.isArray(value.documents)) {
    throw new Error('无效的 MindFlow 备份文件结构');
  }

  const documentIds = new Set<string>();
  for (let i = 0; i < value.documents.length; i += 1) {
    const doc = validateMindMapDocument(value.documents[i], `第 ${i + 1} 篇导图`);
    if (documentIds.has(doc.id)) throw new Error(`备份中存在重复的导图 ID：${doc.id}`);
    documentIds.add(doc.id);
  }

  if (value.inboxItems !== undefined) {
    if (!Array.isArray(value.inboxItems)) throw new Error('备份中的收集箱数据格式无效');
    for (const item of value.inboxItems) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.text !== 'string' ||
          !Number.isFinite(item.createdAt) || typeof item.isProcessed !== 'boolean') {
        throw new Error('备份中包含格式无效的收集箱记录');
      }
    }
  }

  if (value.snapshots !== undefined) {
    if (!Array.isArray(value.snapshots)) throw new Error('备份中的版本快照数据格式无效');
    for (const snapshot of value.snapshots) {
      if (!isRecord(snapshot) || typeof snapshot.id !== 'string' ||
          typeof snapshot.docId !== 'string' || !documentIds.has(snapshot.docId) ||
          typeof snapshot.data !== 'string' || !Number.isFinite(snapshot.timestamp)) {
        throw new Error('备份中包含无效或脱离所属导图的版本快照');
      }
      let snapshotDoc: unknown;
      try {
        snapshotDoc = JSON.parse(snapshot.data);
      } catch {
        throw new Error('备份中包含无法解析的版本快照');
      }
      if (validateMindMapDocument(snapshotDoc, '版本快照').id !== snapshot.docId) {
        throw new Error('备份中的版本快照与所属导图不匹配');
      }
    }
  }

  return value as unknown as WorkspaceBackupData;
}

export class BackupService {
  public static async previewFullWorkspaceData(input: unknown): Promise<WorkspaceRestorePreview> {
    const data = validateWorkspaceData(input);
    const existing = new Set((await StorageService.getDocumentList()).map(doc => doc.id));
    return {
      documents: data.documents.length,
      replacing: data.documents.filter(doc => existing.has(doc.id)).map(doc => doc.title),
      adding: data.documents.filter(doc => !existing.has(doc.id)).map(doc => doc.title),
      inboxItems: data.inboxItems?.length || 0,
      snapshots: data.snapshots?.length || 0,
    };
  }

  public static async previewFullWorkspaceBackup(raw: string): Promise<WorkspaceRestorePreview> {
    if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('备份文件超过 20 MB 安全导入上限');
    return this.previewFullWorkspaceData(JSON.parse(raw));
  }

  public static describeRestorePreview(preview: WorkspaceRestorePreview): string {
    const names = preview.replacing.slice(0, 5).join('、');
    return `备份包含 ${preview.documents} 篇导图（新增 ${preview.adding.length}、覆盖 ${preview.replacing.length}）、${preview.inboxItems} 条收集箱记录、${preview.snapshots} 个快照。${preview.replacing.length ? `\n将覆盖：${names}${preview.replacing.length > 5 ? '等' : ''}。覆盖前会创建本地恢复快照。` : ''}\n确认导入吗？`;
  }
  // 1. Create a version snapshot for a document
  public static async createSnapshot(doc: MindMapDocument): Promise<DocSnapshot> {
    const snapshots = await this.getSnapshots(doc.id);
    const settings = await SettingsService.getSettings();
    const maxSnapshots = Math.max(10, Math.min(50, Math.floor(settings.maxSnapshotsPerDoc || DEFAULT_MAX_SNAPSHOTS_PER_DOC)));
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
    if (snapshots.length > maxSnapshots) {
      snapshots.splice(maxSnapshots);
    }

    await this.saveSnapshots(doc.id, snapshots);
    return newSnapshot;
  }

  public static async createAutoSnapshotIfDue(doc: MindMapDocument, intervalMinutes: number): Promise<boolean> {
    const snapshots = await this.getSnapshots(doc.id);
    const latestTimestamp = snapshots.reduce((latest, item) => Math.max(latest, item.timestamp || 0), 0);
    const intervalMs = Math.max(1, intervalMinutes || 10) * 60 * 1000;
    if (latestTimestamp && Date.now() - latestTimestamp < intervalMs) return false;
    await this.createSnapshot(doc);
    return true;
  }

  // 2. Get snapshots for a document
  public static async getSnapshots(docId: string): Promise<DocSnapshot[]> {
    const key = SNAPSHOT_STORAGE_KEY + docId;
    if (isChromeStorage()) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (res) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '读取版本快照失败'));
            return;
          }
          const raw = res[key];
          if (!raw) return resolve([]);
          try {
            const parsed = JSON.parse(raw as string);
            if (!Array.isArray(parsed)) throw new Error('快照数据不是列表');
            resolve(parsed);
          } catch (error) {
            reject(new Error(`版本快照数据损坏：${(error as Error).message}`));
          }
        });
      });
    }

    const raw = safeStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('快照数据不是列表');
      return parsed;
    } catch (error) {
      throw new Error(`版本快照数据损坏：${(error as Error).message}`);
    }
  }

  // 3. Restore document from a snapshot
  public static async restoreSnapshot(docId: string, snapshotId: string): Promise<MindMapDocument | null> {
    const snapshots = await this.getSnapshots(docId);
    const target = snapshots.find(s => s.id === snapshotId);
    if (!target) return null;

    const doc = validateMindMapDocument(JSON.parse(target.data), '版本快照');
    const current = await StorageService.getDocument(docId);
    if (current) await this.createSnapshot(current);
    return StorageService.saveDocument({ ...doc, updatedAt: Date.now() });
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
      const doc = await StorageService.getDocument(sum.id, { trackRevision: false });
      if (doc) {
        documents.push(doc);
        const snaps = await this.getSnapshots(doc.id);
        allSnapshots.push(...snaps);
      }
    }

    const inboxItems = await InboxService.getItems();

    return {
      version: '1.6.0',
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 6a. Import from WorkspaceBackupData object
  public static async importFullWorkspaceData(data: WorkspaceBackupData): Promise<{ docCount: number; inboxCount: number }> {
    // Validate the entire archive before the first write. A malformed later
    // record must never leave an import half-applied.
    data = validateWorkspaceData(data);

    // Keep a recovery point for any local document that this restore will
    // replace by ID. If snapshot creation fails, stop before overwriting it.
    const existingIds = new Set<string>();
    for (const incoming of data.documents) {
      const current = await StorageService.getDocument(incoming.id);
      if (current) {
        existingIds.add(incoming.id);
        await this.createSnapshot(current);
      }
    }

    // Save all documents
    for (const doc of data.documents) {
      await StorageService.saveDocument(existingIds.has(doc.id) ? doc : { ...doc, revision: 0 }, { force: !existingIds.has(doc.id) });
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
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ mindflow_inbox_items: serialized }, () => {
            const error = chrome.runtime?.lastError;
            if (error) {
              reject(new Error(error.message || '恢复收集箱失败'));
              return;
            }
            resolve();
          });
        });
      } else {
        safeStorage.setItem('mindflow_inbox_items', serialized);
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
    if (new TextEncoder().encode(jsonContent).byteLength > MAX_BACKUP_BYTES) {
      throw new Error('备份文件超过 20 MB 安全导入上限');
    }
    const data = JSON.parse(jsonContent) as WorkspaceBackupData;
    return this.importFullWorkspaceData(validateWorkspaceData(data));
  }

  // 7. Get approximate storage quota
  public static async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (isChromeStorage() && chrome.storage.local.getBytesInUse) {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            resolve({ usedBytes: 0, maxBytes: 10 * 1024 * 1024, percent: 0 });
            return;
          }
          const maxBytes = 10 * 1024 * 1024; // 10MB default for chrome.storage.local
          resolve({
            usedBytes: bytesInUse || 0,
            maxBytes,
            percent: Math.min(100, Math.round(((bytesInUse || 0) / maxBytes) * 100)),
          });
        });
      });
    }

    // Fallback for safeStorage estimation
    const all = safeStorage.getAll();
    let totalLength = 0;
    for (const [k, v] of Object.entries(all)) {
      totalLength += k.length + (v?.length || 0);
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
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: serialized }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || '保存版本快照失败'));
            return;
          }
          resolve();
        });
      });
    }
    safeStorage.setItem(key, serialized);
  }
}
