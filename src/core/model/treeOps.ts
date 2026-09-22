import { MindMapNode, LayoutNode } from './types';

// Generate unique short ID
export function generateId(): string {
  return 'node_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

// Deep clone a node tree, regenerating IDs if requested
export function cloneTree(node: MindMapNode, regenerateIds = false): MindMapNode {
  return {
    ...node,
    id: regenerateIds ? generateId() : node.id,
    tags: node.tags ? [...node.tags] : undefined,
    icons: node.icons ? [...node.icons] : undefined,
    children: node.children ? node.children.map(child => cloneTree(child, regenerateIds)) : []
  };
}

// Find a node by ID in tree
export function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// Find parent and index of a node
export function findParent(root: MindMapNode, id: string): { parent: MindMapNode; index: number } | null {
  if (root.id === id) return null;
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === id) {
      return { parent: root, index: i };
    }
    const found = findParent(root.children[i], id);
    if (found) return found;
  }
  return null;
}

// Add a child node
export function addChildNode(root: MindMapNode, parentId: string, initialText = '分支主题'): { newRoot: MindMapNode; newNodeId: string } {
  const newNodeId = generateId();
  const newNode: MindMapNode = {
    id: newNodeId,
    text: initialText,
    isExpanded: true,
    children: []
  };

  const newRoot = cloneTree(root);
  const targetParent = findNode(newRoot, parentId);
  if (targetParent) {
    if (!targetParent.children) targetParent.children = [];
    targetParent.children.push(newNode);
    targetParent.isExpanded = true;
  }

  return { newRoot, newNodeId };
}

// Add a sibling node (Enter shortcut)
export function addSiblingNode(
  root: MindMapNode,
  targetId: string,
  initialText = '分支主题',
  insertBefore = false
): { newRoot: MindMapNode; newNodeId: string } {
  // If target is root, adding sibling adds a child to root
  if (root.id === targetId) {
    return addChildNode(root, targetId, initialText);
  }

  const newRoot = cloneTree(root);
  const parentInfo = findParent(newRoot, targetId);
  if (!parentInfo) {
    return addChildNode(root, targetId, initialText);
  }

  const newNodeId = generateId();
  const newNode: MindMapNode = {
    id: newNodeId,
    text: initialText,
    isExpanded: true,
    children: []
  };

  const insertIndex = insertBefore ? parentInfo.index : parentInfo.index + 1;
  parentInfo.parent.children.splice(insertIndex, 0, newNode);

  return { newRoot, newNodeId };
}

// Update node attributes
export function updateNode(root: MindMapNode, id: string, patch: Partial<MindMapNode>): MindMapNode {
  const newRoot = cloneTree(root);
  const target = findNode(newRoot, id);
  if (target) {
    Object.assign(target, patch);
  }
  return newRoot;
}

// Delete a node (cannot delete root)
export function deleteNode(root: MindMapNode, id: string): { newRoot: MindMapNode; nextSelectedId: string | null } {
  if (root.id === id) {
    // Cannot delete root, only clear children
    const newRoot = cloneTree(root);
    newRoot.children = [];
    return { newRoot, nextSelectedId: root.id };
  }

  const newRoot = cloneTree(root);
  const parentInfo = findParent(newRoot, id);
  if (!parentInfo) {
    return { newRoot, nextSelectedId: root.id };
  }

  // Determine which node to select next (sibling or parent)
  let nextSelectedId = parentInfo.parent.id;
  if (parentInfo.parent.children.length > 1) {
    if (parentInfo.index > 0) {
      nextSelectedId = parentInfo.parent.children[parentInfo.index - 1].id;
    } else {
      nextSelectedId = parentInfo.parent.children[parentInfo.index + 1].id;
    }
  }

  parentInfo.parent.children.splice(parentInfo.index, 1);
  return { newRoot, nextSelectedId };
}

// Toggle collapse/expand
export function toggleNodeCollapse(root: MindMapNode, id: string): MindMapNode {
  const newRoot = cloneTree(root);
  const target = findNode(newRoot, id);
  if (target && target.children && target.children.length > 0) {
    target.isExpanded = target.isExpanded === false ? true : false;
  }
  return newRoot;
}

// Reparent or reorder node
export function moveNode(
  root: MindMapNode,
  sourceId: string,
  targetParentId: string,
  targetIndex?: number
): MindMapNode {
  if (sourceId === root.id || sourceId === targetParentId) return root;

  // Prevent moving node into its own descendant
  const sourceNode = findNode(root, sourceId);
  if (sourceNode && findNode(sourceNode, targetParentId)) {
    return root;
  }

  const newRoot = cloneTree(root);
  const sourceParentInfo = findParent(newRoot, sourceId);
  if (!sourceParentInfo) return root;

  const [removed] = sourceParentInfo.parent.children.splice(sourceParentInfo.index, 1);
  const targetParent = findNode(newRoot, targetParentId);
  if (!targetParent) return root;

  if (!targetParent.children) targetParent.children = [];
  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= targetParent.children.length) {
    targetParent.children.splice(targetIndex, 0, removed);
  } else {
    targetParent.children.push(removed);
  }
  targetParent.isExpanded = true;

  return newRoot;
}

// Directional navigation between nodes using layout spatial positions
export function findAdjacentNode(
  currentId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  layoutNodes: LayoutNode[]
): string | null {
  const current = layoutNodes.find(n => n.id === currentId);
  if (!current) return null;

  const curCx = current.x + current.width / 2;
  const curCy = current.y + current.height / 2;

  let bestNode: LayoutNode | null = null;
  let bestScore = Infinity;

  for (const target of layoutNodes) {
    if (target.id === currentId) continue;
    const tgtCx = target.x + target.width / 2;
    const tgtCy = target.y + target.height / 2;
    const dx = tgtCx - curCx;
    const dy = tgtCy - curCy;

    let isValid = false;
    let primaryDist = 0;
    let secondaryDist = 0;

    switch (direction) {
      case 'up':
        if (dy < -10) {
          isValid = true;
          primaryDist = -dy;
          secondaryDist = Math.abs(dx);
        }
        break;
      case 'down':
        if (dy > 10) {
          isValid = true;
          primaryDist = dy;
          secondaryDist = Math.abs(dx);
        }
        break;
      case 'left':
        if (dx < -10) {
          isValid = true;
          primaryDist = -dx;
          secondaryDist = Math.abs(dy);
        }
        break;
      case 'right':
        if (dx > 10) {
          isValid = true;
          primaryDist = dx;
          secondaryDist = Math.abs(dy);
        }
        break;
    }

    if (isValid) {
      // Prioritize movement along the chosen axis, penalizing orthogonal distance
      const score = primaryDist + secondaryDist * 2.5;
      if (score < bestScore) {
        bestScore = score;
        bestNode = target;
      }
    }
  }

  return bestNode ? bestNode.id : null;
}

// Duplicate a node and insert as its sibling
export function duplicateNode(
  root: MindMapNode,
  targetId: string
): { newRoot: MindMapNode; newNodeId: string } {
  if (root.id === targetId) return { newRoot: root, newNodeId: root.id };

  const newRoot = cloneTree(root);
  const parentInfo = findParent(newRoot, targetId);
  if (!parentInfo) return { newRoot: root, newNodeId: root.id };

  const targetNode = parentInfo.parent.children[parentInfo.index];
  const duplicatedSubtree = cloneTree(targetNode, true);
  duplicatedSubtree.text = `${duplicatedSubtree.text} (副本)`;

  parentInfo.parent.children.splice(parentInfo.index + 1, 0, duplicatedSubtree);
  return { newRoot, newNodeId: duplicatedSubtree.id };
}

// Paste a cloned subtree under a parent node
export function pasteSubtree(
  root: MindMapNode,
  parentId: string,
  subtree: MindMapNode
): { newRoot: MindMapNode; newNodeId: string } {
  const newRoot = cloneTree(root);
  const targetParent = findNode(newRoot, parentId);
  const pasted = cloneTree(subtree, true);

  if (targetParent) {
    if (!targetParent.children) targetParent.children = [];
    targetParent.children.push(pasted);
    targetParent.isExpanded = true;
  }

  return { newRoot, newNodeId: pasted.id };
}

// Batch delete multiple nodes
export function deleteMultipleNodes(
  root: MindMapNode,
  targetIds: string[]
): { newRoot: MindMapNode; nextSelectedId: string } {
  const idsToDelete = new Set(targetIds.filter(id => id !== root.id));
  if (idsToDelete.size === 0) return { newRoot: root, nextSelectedId: root.id };

  let currentRoot = cloneTree(root);
  let nextSelectedId = root.id;

  function filterChildren(node: MindMapNode): MindMapNode {
    if (!node.children) return node;
    const keptChildren = node.children.filter(c => !idsToDelete.has(c.id));
    return {
      ...node,
      children: keptChildren.map(filterChildren),
    };
  }

  currentRoot = filterChildren(currentRoot);
  return { newRoot: currentRoot, nextSelectedId };
}

// Batch update multiple nodes
export function updateMultipleNodes(
  root: MindMapNode,
  targetIds: string[],
  patch: Partial<MindMapNode>
): MindMapNode {
  const idSet = new Set(targetIds);
  function walk(node: MindMapNode): MindMapNode {
    const isTarget = idSet.has(node.id);
    const updated = isTarget ? { ...node, ...patch } : node;
    return {
      ...updated,
      children: node.children ? node.children.map(walk) : [],
    };
  }
  return walk(root);
}
