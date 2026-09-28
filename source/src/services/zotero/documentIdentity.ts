import { MindMapDocument } from '../../core/model/types';

/** Local document IDs cannot identify the physical Zotero attachment. */
export function documentSource(doc: MindMapDocument): string | null {
  const meta = doc.metadata || {};
  if (meta.zoteroAttachmentKey && meta.zoteroAttachmentLibraryID) {
    return `attachment:${meta.zoteroAttachmentLibraryID}:${meta.zoteroAttachmentKey}`;
  }
  return null;
}

export function sameDocumentSource(a: MindMapDocument, b: MindMapDocument): boolean {
  const source = documentSource(a);
  return source !== null && source === documentSource(b);
}

export function planIncomingDocument(incoming: MindMapDocument, local: MindMapDocument | null):
  'import' | 'fork' | 'local' | 'replace' {
  if (!local) return 'import';
  if (!sameDocumentSource(incoming, local)) return 'fork';
  return local.updatedAt >= incoming.updatedAt ? 'local' : 'replace';
}

/** Backups and conflict copies stay detached until the user deliberately links them. */
export function detachedMetadata(metadata: MindMapDocument['metadata']) {
  const copy = { ...metadata, autoSyncToZotero: false };
  for (const key of ['zoteroItemKey', 'zoteroUri', 'zoteroLibraryID',
    'zoteroItemTitle', 'zoteroAttachmentKey', 'zoteroAttachmentLibraryID', 'mindflowUnlinkedContainer']) {
    delete (copy as Record<string, unknown>)[key];
  }
  return copy;
}
