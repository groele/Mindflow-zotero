import { MindMapNode, LayoutNode, ConnectionCurve, LayoutType, ThemeColors, NodeShape } from '../model/types';
import { imageDisplayHeight, isSafeNodeImage } from '../model/nodeImage';

// Approximate dimensions for a node based on content
export function measureNode(node: MindMapNode, level: number, reading = false): { width: number; height: number } {
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
  if (node.internalLink) extraWidth += 20;
  if (node.task) {
    extraWidth += 26;
  }

  if (isSafeNodeImage(node.image)) {
    const baseWidth = level === 0 ? 120 : level === 1 ? 90 : 70;
    const textWidth = estimatedTextWidth + (level === 0 ? 48 : level === 1 ? 36 : 28) + extraWidth;
    return {
      width: Math.max(baseWidth, node.image.width + 24, Math.min(textWidth, 520)),
      height: imageDisplayHeight(node.image) + 16 + (node.text || node.task || node.tags?.length || node.icons?.length || node.note || node.link || node.internalLink ? 30 : 0),
    };
  }

  if (reading) {
    const maxWidth = level === 0 ? 480 : level === 1 ? 300 : level === 2 ? 240 : 500;
    const width = Math.min(maxWidth, Math.max(100, readingTextWidth(text) + 28 + extraWidth));
    const lines = wrapReadingText(text, Math.max(30, width - 28 - extraWidth));
    return { width, height: lines.length * 20 + 14 };
  }

  const padding = level === 0 ? 48 : level === 1 ? 36 : 28;
  const width = Math.min(level === 0 ? 520 : level === 1 ? 360 : 300,
    Math.max(level === 0 ? 140 : level === 1 ? 90 : 70, estimatedTextWidth + padding + extraWidth));
  const lines = wrapReadingText(text, Math.max(30, width - padding - extraWidth));
  return { width, height: Math.max(level === 0 ? 46 : level === 1 ? 38 : 32, lines.length * 20 + 14) };
}

// Conservatively sized for 14px Microsoft YaHei. One shared set of line breaks
// prevents canvas, SVG, PNG and HTML from showing different or clipped text.
function readingTextWidth(text: string): number {
  return [...text].reduce((width, char) => width + (char.codePointAt(0)! > 255 ? 14.5 : 8.5), 0);
}
export function wrapReadingText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '', width = 0;
    for (const char of paragraph) {
      const charWidth = readingTextWidth(char);
      if (line && width + charWidth > maxWidth) { lines.push(line); line = ''; width = 0; }
      line += char; width += charWidth;
    }
    lines.push(line);
  }
  return lines;
}

interface LayoutResult {
  nodes: LayoutNode[];
  connections: ConnectionCurve[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface LayoutOptions {
  rainbowBranches?: boolean;
  curveStyle?: 'bezier' | 'straight' | 'rounded';
}

export const RAINBOW_BRANCH_COLORS = [
  '#3b82f6', // 经典蓝
  '#10b981', // 翡翠绿
  '#f59e0b', // 暖琥珀
  '#ec4899', // 霓虹粉
  '#8b5cf6', // 优雅紫
  '#06b6d4', // 清透青
  '#f97316', // 活力橙
  '#14b8a6', // 松柏青
  '#e11d48', // 胭脂红
  '#6366f1', // 靛青蓝
];

export function computeLayout(
  root: MindMapNode,
  layoutType: LayoutType,
  theme: ThemeColors,
  options?: LayoutOptions
): LayoutResult {
  const nodes: LayoutNode[] = [];
  const connections: ConnectionCurve[] = [];
  const reading = theme.id === 'paper-reading';
  const curveStyle = reading ? 'rounded' : options?.curveStyle || 'bezier';
  const branchColors = !reading && options?.rainbowBranches ? RAINBOW_BRANCH_COLORS : theme.branchColors;

  switch (layoutType) {
    case 'mindmap':
      computeMindmapLayout(root, theme, nodes, connections, branchColors, curveStyle);
      break;
    case 'logic-right':
      computeLogicRightLayout(root, theme, nodes, connections, branchColors, curveStyle);
      break;
    case 'org-down':
      computeOrgDownLayout(root, theme, nodes, connections, branchColors, curveStyle);
      break;
  }

  for (const n of nodes) {
    let extras = (n.node.icons?.length || 0) * 22 + (n.node.tags?.length || 0) * 36;
    if (n.node.note) extras += 20;
    if (n.node.link) extras += 20;
    if (n.node.internalLink) extras += 20;
    if (n.node.task) extras += 26;
    if (!isSafeNodeImage(n.node.image)) {
      const padding = reading ? 28 : n.level === 0 ? 48 : n.level === 1 ? 36 : 28;
      const lines = wrapReadingText(n.node.text || ' ', Math.max(30, n.width - padding - extras));
      if (reading || lines.length > 1) n.textLines = lines;
    }
    n.readingStyle = reading;
    if (reading) {
      n.bgColor = n.level === 0 ? theme.rootBg : n.level === 1 ? '#e2efea' : 'transparent';
      n.borderColor = n.level === 1 ? '#c7ded6' : 'transparent';
    }
  }
  if (reading) {
    connections.forEach(connection => { connection.strokeWidth = 1; });
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
  outConnections: ConnectionCurve[],
  branchColors: string[] = theme.branchColors,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
) {
  const rootDim = measureNode(root, 0, theme.id === 'paper-reading');
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: -rootDim.width / 2,
    y: -rootDim.height / 2,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: branchColors[0] || theme.branchColors[0],
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
      0, // color index start
      branchColors,
      curveStyle
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
      rightChildren.length, // offset color index
      branchColors,
      curveStyle
    );
  }
}

// Subtree hierarchy height calculator
function calculateSubtreeHeight(node: MindMapNode, level: number, reading = false): number {
  const selfHeight = measureNode(node, level, reading).height;
  if (!node.children || node.children.length === 0 || node.isExpanded === false) {
    return selfHeight;
  }
  const childGap = reading ? 12 : 16;
  let totalChildrenHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalChildrenHeight += calculateSubtreeHeight(node.children[i], level + 1, reading);
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
  branchColorOffset = 0,
  branchColors: string[] = theme.branchColors,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
) {
  const reading = theme.id === 'paper-reading';
  const childGap = reading ? 12 : 16;
  const levelXGap = reading ? (level === 1 ? 88 : 48) : 64;

  // Compute heights of each child subtree
  const heights = children.map(c => calculateSubtreeHeight(c, level, reading));
  const totalHeight = heights.reduce((sum, h) => sum + h, 0) + (children.length - 1) * childGap;

  const parentCenterY = parentNode.y + parentNode.height / 2;
  let currentY = parentCenterY - totalHeight / 2;

  children.forEach((child, index) => {
    const subHeight = heights[index];
    const childDim = measureNode(child, level, theme.id === 'paper-reading');

    // Color: level 1 gets new color; subsequent levels inherit parent color
    const branchColor = level === 1
      ? branchColors[(branchColorOffset + index) % branchColors.length]
      : parentNode.color;

    let childX = 0;
    if (side === 'right') {
      childX = parentNode.x + parentNode.width + levelXGap;
    } else {
      childX = parentNode.x - levelXGap - childDim.width;
    }

    const childY = currentY + (subHeight - childDim.height) / 2;

    const childShape: NodeShape = child.shape || (isSafeNodeImage(child.image) || level === 1 ? 'rounded' : 'underline');

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
    const curve = createHorizontalCurve(parentNode, layoutChild, side, child.color || branchColor, curveStyle);
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
        branchColorOffset,
        branchColors,
        curveStyle
      );
    }

    currentY += subHeight + childGap;
  });
}

function createHorizontalCurve(
  from: LayoutNode,
  to: LayoutNode,
  side: 'left' | 'right',
  color: string,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
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

  let path = '';
  if (curveStyle === 'straight') {
    path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  } else if (curveStyle === 'rounded') {
    const midX = (x1 + x2) / 2;
    const radius = Math.min(5, Math.abs(y2 - y1) / 2);
    const signY = Math.sign(y2 - y1), signX = Math.sign(x2 - x1);
    path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} H ${midX.toFixed(1)} V ${(y2 - signY * radius).toFixed(1)} Q ${midX.toFixed(1)} ${y2.toFixed(1)} ${(midX + signX * radius).toFixed(1)} ${y2.toFixed(1)} H ${x2.toFixed(1)}`;
  } else {
    // bezier
    const dx = x2 - x1;
    const cp1x = x1 + dx * 0.45;
    const cp1y = y1;
    const cp2x = x1 + dx * 0.55;
    const cp2y = y2;
    path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

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
  outConnections: ConnectionCurve[],
  branchColors: string[] = theme.branchColors,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
) {
  const rootDim = measureNode(root, 0, theme.id === 'paper-reading');
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: 40,
    y: 0,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: branchColors[0] || theme.branchColors[0],
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
    0,
    branchColors,
    curveStyle
  );
}

// 3. Organization Structure Layout (Top-Down)
function computeOrgDownLayout(
  root: MindMapNode,
  theme: ThemeColors,
  outNodes: LayoutNode[],
  outConnections: ConnectionCurve[],
  branchColors: string[] = theme.branchColors,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
) {
  const rootDim = measureNode(root, 0, theme.id === 'paper-reading');
  const rootNode: LayoutNode = {
    id: root.id,
    node: root,
    x: -rootDim.width / 2,
    y: 0,
    width: rootDim.width,
    height: rootDim.height,
    level: 0,
    color: branchColors[0] || theme.branchColors[0],
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

  layoutOrgSubtree(rootNode, root.children, 1, theme, outNodes, outConnections, branchColors, curveStyle);
}

function calculateOrgSubtreeWidth(node: MindMapNode, level: number, reading = false): number {
  const selfWidth = measureNode(node, level, reading).width;
  if (!node.children || node.children.length === 0 || node.isExpanded === false) {
    return selfWidth;
  }
  const childGap = 24;
  let totalChildWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalChildWidth += calculateOrgSubtreeWidth(node.children[i], level + 1, reading);
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
  outConnections: ConnectionCurve[],
  branchColors: string[] = theme.branchColors,
  curveStyle: 'bezier' | 'straight' | 'rounded' = 'bezier'
) {
  const childGap = 24;
  const levelYGap = 54;

  const widths = children.map(c => calculateOrgSubtreeWidth(c, level, theme.id === 'paper-reading'));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (children.length - 1) * childGap;

  const parentCenterX = parentNode.x + parentNode.width / 2;
  let currentX = parentCenterX - totalWidth / 2;
  const childY = parentNode.y + parentNode.height + levelYGap;

  children.forEach((child, index) => {
    const subWidth = widths[index];
    const childDim = measureNode(child, level, theme.id === 'paper-reading');
    const branchColor = level === 1
      ? branchColors[index % branchColors.length]
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

    let path = '';
    if (curveStyle === 'straight') {
      path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    } else if (curveStyle === 'rounded') {
      const midY = (y1 + y2) / 2;
      path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} V ${midY.toFixed(1)} H ${x2.toFixed(1)} V ${y2.toFixed(1)}`;
    } else {
      // bezier
      const midY = (y1 + y2) / 2;
      path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }

    outConnections.push({
      id: `conn_${parentNode.id}_${layoutChild.id}`,
      fromId: parentNode.id,
      toId: layoutChild.id,
      path,
      color: child.color || branchColor,
      strokeWidth: Math.max(1.5, 3 - level * 0.4)
    });

    if (child.children && child.children.length > 0 && child.isExpanded !== false) {
      layoutOrgSubtree(layoutChild, child.children, level + 1, theme, outNodes, outConnections, branchColors, curveStyle);
    }

    currentX += subWidth + childGap;
  });
}
