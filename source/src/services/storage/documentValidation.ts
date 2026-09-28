import { MindMapDocument } from '../../core/model/types';
import { isSafeNodeImage } from '../../core/model/nodeImage';
const MAX_NODES_PER_DOCUMENT = 25000;
const MAX_NODE_DEPTH = 256;
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function validateMindMapDocument(value: unknown, label = '导图'): MindMapDocument {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,148}$/.test(value.id) ||
      typeof value.title !== 'string' ||
      typeof value.themeId !== 'string' ||
      !['mindmap', 'logic-right', 'org-down'].includes(String(value.layoutType)) ||
      !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt) ||
      (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0)) ||
      (value.metadata !== undefined && !isRecord(value.metadata)) || !isRecord(value.root)) {
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
    const relationshipIds = new Set<string>();
    for (const relationship of value.relationships) {
      if (!isRecord(relationship) || typeof relationship.id !== 'string' ||
          typeof relationship.fromId !== 'string' || typeof relationship.toId !== 'string' ||
          !relationship.id || relationshipIds.has(relationship.id) ||
          !seenNodeIds.has(relationship.fromId) || !seenNodeIds.has(relationship.toId)) {
        throw new Error(`${label}包含指向不存在节点的关系线`);
      }
      relationshipIds.add(relationship.id);
    }
  }

  return value as unknown as MindMapDocument;
}
