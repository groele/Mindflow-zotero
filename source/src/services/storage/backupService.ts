import { MindMapDocument, InboxItem } from '../../core/model/types';
import { APP_VERSION } from '../../core/version';
import { StorageService } from './storageService';
import { InboxService, validateInboxItems } from './inboxService';
import { generateId } from '../../core/model/treeOps';
import { SettingsService } from './settingsService';
import { validateMindMapDocument } from './documentValidation';
export { validateMindMapDocument } from './documentValidation';
import { safeStorage } from './safeStorage';
import { detachedMetadata } from '../zotero/documentIdentity';
import { isZoteroWorkspace, zoteroWorkspaceStorage } from '../zotero/zoteroBridge';

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
    validateInboxItems(value.inboxItems);
  }

  if (value.snapshots !== undefined) {
    const snapshots = validateSnapshots(value.snapshots);
    for (const snapshot of snapshots) {
      if (!documentIds.has(snapshot.docId)) throw new Error('备份中包含脱离所属导图的版本快照');
    }
  }

  return value as unknown as WorkspaceBackupData;
}

/** Validate envelopes and payloads before rendering or mutating snapshot storage. */
export function validateSnapshots(value: unknown, docId?: string): DocSnapshot[] {
  if (!Array.isArray(value)) throw new Error('版本快照数据不是列表');
  const ids = new Set<string>();
  for (const snapshot of value) {
    if (!isRecord(snapshot) || typeof snapshot.id !== 'string' || !snapshot.id ||
        typeof snapshot.docId !== 'string' || !snapshot.docId ||
        (docId !== undefined && snapshot.docId !== docId) ||
        typeof snapshot.title !== 'string' || typeof snapshot.data !== 'string' ||
        !Number.isFinite(snapshot.timestamp) || (snapshot.timestamp as number) < 0 ||
        (snapshot.nodeCount !== undefined && (!Number.isSafeInteger(snapshot.nodeCount) || (snapshot.nodeCount as number) < 1))) {
      throw new Error('版本快照身份或属性无效');
    }
    if (ids.has(snapshot.id)) throw new Error('版本快照包含重复的 ID');
    ids.add(snapshot.id);
    const doc = validateMindMapDocument(JSON.parse(snapshot.data), '版本快照');
    if (doc.id !== snapshot.docId) throw new Error('版本快照所属导图与内部文档 ID 不一致');
  }
  return value as DocSnapshot[];
}

export class BackupService {
  private static snapshotQueue: Promise<unknown> = Promise.resolve();

  private static async mutateSnapshots(docId: string, additions: DocSnapshot[] = [], removeSnapshotId?: string, limit?: number): Promise<void> {
    if (isZoteroWorkspace()) {
      await zoteroWorkspaceStorage('mutateSnapshots', { docId, snapshots: additions, removeSnapshotId, limit });
      return;
    }
    const operation = this.snapshotQueue.then(async () => {
      let snapshots = (await this.getSnapshots(docId)).filter(s => s.id !== removeSnapshotId);
      for (const snapshot of additions) if (!snapshots.some(s=>s.id===snapshot.id)) snapshots.push(snapshot);
      snapshots.sort((a,b)=>b.timestamp-a.timestamp);
      if (limit) snapshots=snapshots.slice(0,limit);
      await this.saveSnapshots(docId,snapshots);
    });
    this.snapshotQueue=operation.catch(()=>undefined);
    await operation;
  }
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
    validateMindMapDocument(doc, '待备份导图');
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
    await this.mutateSnapshots(doc.id,[newSnapshot],undefined,maxSnapshots);
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
    const raw = isZoteroWorkspace() ? await zoteroWorkspaceStorage('get',{key}) : safeStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return validateSnapshots(parsed, docId).sort((a, b) => b.timestamp - a.timestamp);
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
    if (target.docId !== docId || doc.id !== docId) throw new Error('版本快照所属导图与内部文档 ID 不一致；已停止恢复');
    const current = await StorageService.getDocument(docId, { trackRevision: false });
    if (current) await this.createSnapshot(current);
    const metadata = { ...detachedMetadata(doc.metadata) };
    // A history rollback restores content, while the current archive location
    // remains authoritative after a deliberate re-association.
    for (const key of ['zoteroItemKey','zoteroUri','zoteroLibraryID','zoteroItemTitle',
      'zoteroAttachmentKey','zoteroAttachmentLibraryID','mindflowUnlinkedContainer','autoSyncToZotero'] as const) {
      if (current?.metadata?.[key] !== undefined) (metadata as any)[key] = current.metadata[key];
    }
    return StorageService.saveDocumentDirect({ ...doc, metadata, updatedAt: Date.now() }, current?.revision || 0);
  }

  // 4. Delete a snapshot
  public static async deleteSnapshot(docId: string, snapshotId: string): Promise<void> {
    await this.mutateSnapshots(docId,[],snapshotId);
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
      version: APP_VERSION,
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
    data = validateWorkspaceData(JSON.parse(JSON.stringify(data)));

    // Keep a recovery point for any local document that this restore will
    // replace by ID. If snapshot creation fails, stop before overwriting it.
    const existingIds = new Set<string>();
    const revisions = new Map<string, number>();
    for (const incoming of data.documents) await this.getSnapshots(incoming.id);
    const settings = await SettingsService.getSettings();
    const snapshotLimit = Math.max(10, Math.min(50, Math.floor(settings.maxSnapshotsPerDoc || DEFAULT_MAX_SNAPSHOTS_PER_DOC)));
    for (const incoming of data.documents) {
      const current = await StorageService.getDocument(incoming.id, { trackRevision: false });
      if (current) {
        existingIds.add(incoming.id);
        revisions.set(incoming.id, current.revision || 0);
        await this.createSnapshot(current);
      }
    }

    // Save all documents
    let savedCount = 0;
    for (const doc of data.documents) {
      try {
        await StorageService.saveDocumentDirect(existingIds.has(doc.id) ? doc : { ...doc, revision: 0 },
          revisions.get(doc.id) || 0, existingIds.has(doc.id) ? false : 'restore-deleted');
        savedCount += 1;
      } catch (error) {
        throw new Error(`备份恢复中断：已保存 ${savedCount}/${data.documents.length} 篇导图；停止于 ${doc.title}。覆盖前快照已保留。${error instanceof Error ? error.message : error}`);
      }
    }

    // Report post-document failures as partial recovery, never as invalid JSON.
    let stage = '收集箱记录';
    try {
      if (data.inboxItems) await InboxService.mergeItems(data.inboxItems);
      stage = '版本快照';
      const grouped = new Map<string, DocSnapshot[]>();
      for (const snapshot of data.snapshots || []) {
        const snapshots = grouped.get(snapshot.docId) || [];
        snapshots.push(snapshot);
        grouped.set(snapshot.docId, snapshots);
      }
      for (const [docId, snapshots] of grouped) {
        await this.mutateSnapshots(docId, snapshots, undefined, snapshotLimit);
      }
    } catch (error) {
      throw new Error(`备份恢复未全部完成：已保存 ${savedCount}/${data.documents.length} 篇导图；${stage}恢复失败。覆盖前快照已保留。${error instanceof Error ? error.message : error}`);
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
    const all = { ...safeStorage.getAll(), ...(isZoteroWorkspace() ? await zoteroWorkspaceStorage('getAll') : {}) };
    const usedBytes = Object.entries(all).reduce((sum,[key,value]) => sum + new TextEncoder().encode(key + String(value)).byteLength,0);
    const maxBytes = 50 * 1024 * 1024; // Display reference; not a filesystem quota.
    return {
      usedBytes,
      maxBytes,
      percent: Math.min(100, Math.round((usedBytes / maxBytes) * 100)),
    };
  }

  private static async saveSnapshots(docId: string, snapshots: DocSnapshot[]): Promise<void> {
    const key = SNAPSHOT_STORAGE_KEY + docId;
    const serialized = JSON.stringify(snapshots);
    safeStorage.setItem(key, serialized);
  }
}
