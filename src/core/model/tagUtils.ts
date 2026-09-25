import { MindMapNode } from './types';

export interface TagFacet {
  tag: string;
  nodes: Array<{ id: string; text: string }>;
}

export function collectTagFacets(root: MindMapNode): TagFacet[] {
  const byTag = new Map<string, Array<{ id: string; text: string }>>();
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    for (const tag of new Set(node.tags || [])) {
      if (!tag.trim()) continue;
      const nodes = byTag.get(tag) || [];
      nodes.push({ id: node.id, text: node.text });
      byTag.set(tag, nodes);
    }
    for (let i = node.children.length - 1; i >= 0; i -= 1) pending.push(node.children[i]);
  }
  return Array.from(byTag, ([tag, nodes]) => ({ tag, nodes }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.tag.localeCompare(b.tag, 'zh-CN'));
}
