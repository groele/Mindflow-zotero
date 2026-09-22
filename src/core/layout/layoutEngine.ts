import { MindMapNode, LayoutNode, ConnectionCurve, LayoutType, ThemeColors, NodeShape } from '../model/types';

// Approximate dimensions for a node based on content
export function measureNode(node: MindMapNode, level: number): { width: number; height: number } {
  const text = node.text || ' ';
  // Approximate character width (Chinese chars ~ 15px, Latin ~ 8.5px)
  let estimatedTextWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    estimatedTextWidth += (code > 255) ? 15 : 8.5;
  }

  // Add extra spacing for icons and tags
  let extraWidth = 0;
  if (node.icons && node.icons.length > 0) {
    extraWidth += node.icons.length * 22;
  }
  if (node.tags && node.tags.length > 0) {
    extraWidth += node.tags.length * 36;
  }
  if (node.link) {
    extraWidth += 20;
  }
  if (node.note) {
    extraWidth += 20;
  }
  if (node.task) {
    extraWidth += 26;
  }

  if (level === 0) {
    const w = Math.max(120, estimatedTextWidth + 48 + extraWidth);
    return { width: Math.min(w, 360), height: 46 };
  } else if (level === 1) {
    const w = Math.max(90, estimatedTextWidth + 36 + extraWidth);
    return { width: Math.min(w, 320), height: 38 };
  } else {
    const w = Math.max(70, estimatedTextWidth + 28 + extraWidth);
    return { width: Math.min(w, 280), height: 32 };
  }
}

interface LayoutResult {
  nodes: LayoutNode[];
  connections: ConnectionCurve[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function computeLayout(
  root: MindMapNode,
  layoutType: LayoutType,
  theme: ThemeColors
): LayoutResult {
  const nodes: LayoutNode[] = [];
  const connections: ConnectionCurve[] = [];

  switch (layoutType) {
    case 'mindmap':
      computeMindmapLayout(root, theme, nodes, connections);
      break;
    case 'logic-right':
      computeLogicRightLayout(root, theme, nodes, connections);
      break;
    case 'org-down':
      computeOrgDownLayout(root, theme, nodes, connections);
      break;
  }

  // Calculate overall bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  if (nodes.length === 0) {
    minX = -100; maxX = 100; minY = -50; maxY = 50;
  }

  return {
    nodes,
    connections,
    bounds: { minX, maxX, minY, maxY }
  };
}

// 1. Standard Balanced Mind Map Layout (Left and Right)
function computeMindmapLayout(
  root: MindMapNode,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[]
) {
  const rootDim = measureNode(root, 0);
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: -rootDim.width / 2,
    y: -rootDim.height / 2,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: theme.branchColors[0],
    textColor: theme.rootText,
    bgColor: theme.rootBg,
    borderColor: theme.rootBg,
    shape: root.shape || 'rounded',
    children: []
  };
  outNodes.push(rootNode);

  if (!root.children || root.children.length === 0 || root.isExpanded === false) {
    return;
  }

  // Distribute children between right side and left side
  const rightChildren: MindMapNode[] = [];
  const leftChildren: MindMapNode[] = [];

  root.children.forEach((child, idx) => {
    if (idx % 2 === 0) {
      rightChildren.push(child);
    } else {
      leftChildren.push(child);
    }
  });

  // Layout right side
  if (rightChildren.length > 0) {
    layoutSubtree(
      rootNode,
      rightChildren,
      'right',
      1,
      theme,
      outNodes,
      outConnections,
      0 // color index start
    );
  }

  // Layout left side
  if (leftChildren.length > 0) {
    layoutSubtree(
      rootNode,
      leftChildren,
      'left',
      1,
      theme,
      outNodes,
      outConnections,
      rightChildren.length // offset color index
    );
  }
}

// Subtree hierarchy height calculator
function calculateSubtreeHeight(node: MindMapNode, level: number): number {
  const selfHeight = measureNode(node, level).height;
  if (!node.children || node.children.length === 0 || node.isExpanded === false) {
    return selfHeight;
  }
  const childGap = 16;
  let totalChildrenHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalChildrenHeight += calculateSubtreeHeight(node.children[i], level + 1);
    if (i < node.children.length - 1) totalChildrenHeight += childGap;
  }
  return Math.max(selfHeight, totalChildrenHeight);
}

// Recursively place horizontal subtree
function layoutSubtree(
  parentNode: LayoutNode,
  children: MindMapNode[],
  side: 'left' | 'right',
  level: number,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[],
  branchColorOffset = 0
) {
  const childGap = 16;
  const levelXGap = 64;

  // Compute heights of each child subtree
  const heights = children.map(c => calculateSubtreeHeight(c, level));
  const totalHeight = heights.reduce((sum, h) => sum + h, 0) + (children.length - 1) * childGap;

  const parentCenterY = parentNode.y + parentNode.height / 2;
  let currentY = parentCenterY - totalHeight / 2;

  children.forEach((child, index) => {
    const subHeight = heights[index];
    const childDim = measureNode(child, level);

    // Color: level 1 gets new color; subsequent levels inherit parent color
    const branchColor = level === 1
      ? theme.branchColors[(branchColorOffset + index) % theme.branchColors.length]
      : parentNode.color;

    let childX = 0;
    if (side === 'right') {
      childX = parentNode.x + parentNode.width + levelXGap;
    } else {
      childX = parentNode.x - levelXGap - childDim.width;
    }

    const childY = currentY + (subHeight - childDim.height) / 2;

    const childShape: NodeShape = child.shape || (level === 1 ? 'rounded' : 'underline');

    const layoutChild: LayoutNode = {
      id: child.id,
      node: child,
      x: childX,
      y: childY,
      width: childDim.width,
      height: childDim.height,
      level,
      side,
      color: child.color || branchColor,
      textColor: child.textColor || theme.nodeText,
      bgColor: theme.nodeBg,
      borderColor: child.color || branchColor,
      shape: childShape,
      children: [],
      parent: parentNode
    };

    parentNode.children.push(layoutChild);
    outNodes.push(layoutChild);

    // Build connection line
    const curve = createHorizontalCurve(parentNode, layoutChild, side, child.color || branchColor);
    outConnections.push(curve);

    // Recurse for deeper children
    if (child.children && child.children.length > 0 && child.isExpanded !== false) {
      layoutSubtree(
        layoutChild,
        child.children,
        side,
        level + 1,
        theme,
        outNodes,
        outConnections,
        branchColorOffset
      );
    }

    currentY += subHeight + childGap;
  });
}

function createHorizontalCurve(
  from: LayoutNode,
  to: LayoutNode,
  side: 'left' | 'right',
  color: string
): ConnectionCurve {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

  if (side === 'right') {
    x1 = from.x + from.width;
    y1 = from.y + from.height / 2;
    x2 = to.x;
    y2 = to.y + to.height / 2;
  } else {
    x1 = from.x;
    y1 = from.y + from.height / 2;
    x2 = to.x + to.width;
    y2 = to.y + to.height / 2;
  }

  const dx = x2 - x1;
  const cp1x = x1 + dx * 0.45;
  const cp1y = y1;
  const cp2x = x1 + dx * 0.55;
  const cp2y = y2;

  const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;

  return {
    id: `conn_${from.id}_${to.id}`,
    fromId: from.id,
    toId: to.id,
    path,
    color,
    strokeWidth: Math.max(1.5, 3.2 - to.level * 0.5)
  };
}

// 2. Logic Chart Layout (Right only)
function computeLogicRightLayout(
  root: MindMapNode,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[]
) {
  const rootDim = measureNode(root, 0);
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: 40,
    y: 0,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: theme.branchColors[0],
    textColor: theme.rootText,
    bgColor: theme.rootBg,
    borderColor: theme.rootBg,
    shape: root.shape || 'rounded',
    children: []
  };
  outNodes.push(rootNode);

  if (!root.children || root.children.length === 0 || root.isExpanded === false) {
    return;
  }

  layoutSubtree(
    rootNode,
    root.children,
    'right',
    1,
    theme,
    outNodes,
    outConnections,
    0
  );
}

// 3. Organization Structure Layout (Top-Down)
function computeOrgDownLayout(
  root: MindMapNode,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[]
) {
  const rootDim = measureNode(root, 0);
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: -rootDim.width / 2,
    y: 0,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: theme.branchColors[0],
    textColor: theme.rootText,
    bgColor: theme.rootBg,
    borderColor: theme.rootBg,
    shape: root.shape || 'rounded',
    children: []
  };
  outNodes.push(rootNode);

  if (!root.children || root.children.length === 0 || root.isExpanded === false) {
    return;
  }

  layoutOrgSubtree(rootNode, root.children, 1, theme, outNodes, outConnections);
}

function calculateOrgSubtreeWidth(node: MindMapNode, level: number): number {
  const selfWidth = measureNode(node, level).width;
  if (!node.children || node.children.length === 0 || node.isExpanded === false) {
    return selfWidth;
  }
  const childGap = 24;
  let totalChildWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalChildWidth += calculateOrgSubtreeWidth(node.children[i], level + 1);
    if (i < node.children.length - 1) totalChildWidth += childGap;
  }
  return Math.max(selfWidth, totalChildWidth);
}

function layoutOrgSubtree(
  parentNode: LayoutNode,
  children: MindMapNode[],
  level: number,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[]
) {
  const childGap = 24;
  const levelYGap = 54;

  const widths = children.map(c => calculateOrgSubtreeWidth(c, level));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (children.length - 1) * childGap;

  const parentCenterX = parentNode.x + parentNode.width / 2;
  let currentX = parentCenterX - totalWidth / 2;
  const childY = parentNode.y + parentNode.height + levelYGap;

  children.forEach((child, index) => {
    const subWidth = widths[index];
    const childDim = measureNode(child, level);
    const branchColor = level === 1
      ? theme.branchColors[index % theme.branchColors.length]
      : parentNode.color;

    const childX = currentX + (subWidth - childDim.width) / 2;

    const layoutChild: LayoutNode = {
      id: child.id,
      node: child,
      x: childX,
      y: childY,
      width: childDim.width,
      height: childDim.height,
      level,
      side: 'down',
      color: child.color || branchColor,
      textColor: child.textColor || theme.nodeText,
      bgColor: theme.nodeBg,
      borderColor: child.color || branchColor,
      shape: child.shape || 'rounded',
      children: [],
      parent: parentNode
    };

    parentNode.children.push(layoutChild);
    outNodes.push(layoutChild);

    // Downward curve
    const x1 = parentNode.x + parentNode.width / 2;
    const y1 = parentNode.y + parentNode.height;
    const x2 = layoutChild.x + layoutChild.width / 2;
    const y2 = layoutChild.y;

    const midY = (y1 + y2) / 2;
    const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    outConnections.push({
      id: `conn_${parentNode.id}_${layoutChild.id}`,
      fromId: parentNode.id,
      toId: layoutChild.id,
      path,
      color: child.color || branchColor,
      strokeWidth: Math.max(1.5, 3 - level * 0.4)
    });

    if (child.children && child.children.length > 0 && child.isExpanded !== false) {
      layoutOrgSubtree(layoutChild, child.children, level + 1, theme, outNodes, outConnections);
    }

    currentX += subWidth + childGap;
  });
}
