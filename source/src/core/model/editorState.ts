import type { MindMapDocument, MindMapNode, RelationshipLink } from './types';
import { findNode, updateNode } from './treeOps';

export function validRelationships(root: MindMapNode, relationships: RelationshipLink[]): RelationshipLink[] {
  const ids = new Set<string>(), pending = [root];
  while (pending.length) { const node = pending.pop()!; ids.add(node.id); pending.push(...node.children); }
  const filtered = relationships.filter(link => ids.has(link.fromId) && ids.has(link.toId));
  return filtered.length === relationships.length ? relationships : filtered;
}

export function captureNodeDrafts(doc: MindMapDocument | null, drafts: Iterable<{ id: string; text: string }>): MindMapDocument | null {
  if (!doc) return null;
  let root = doc.root;
  for (const draft of drafts) {
    const text = draft.text.trim(), target = findNode(root, draft.id);
    if (target && text && target.text !== text) root = updateNode(root, draft.id, { text });
  }
  return root === doc.root ? doc : { ...doc, root, updatedAt: Date.now() };
}

export function retargetDocumentLinks(root: MindMapNode, oldDocumentId: string, newDocumentId: string): MindMapNode {
  return { ...root,
    internalLink: root.internalLink?.documentId === oldDocumentId
      ? { ...root.internalLink, documentId: newDocumentId } : root.internalLink,
    children: root.children.map(child => retargetDocumentLinks(child, oldDocumentId, newDocumentId)),
  };
}
