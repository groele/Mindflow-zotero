import { MindMapDocument, MindMapNode, LayoutNode, ConnectionCurve, ThemeColors } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';

// Export as formatted JSON
export function exportToJSON(doc: MindMapDocument): void {
  const jsonStr = JSON.stringify(doc, null, 2);
  downloadBlob(new Blob([jsonStr], { type: 'application/json' }), `${doc.title}.mindflow.json`);
}

// Export to Markdown
export function exportToMarkdown(root: MindMapNode, title: string): void {
  const lines: string[] = [`# ${root.text}\n`];

  function walk(node: MindMapNode, depth: number) {
    for (const child of node.children) {
      const indent = '  '.repeat(depth);
      let line = `${indent}- ${child.text}`;
      if (child.link) {
        line += ` [🔗](${child.link})`;
      }
      if (child.tags && child.tags.length > 0) {
        line += ` ${child.tags.map(t => `#${t}`).join(' ')}`;
      }
      if (child.note) {
        line += ` <!-- 备注: ${child.note} -->`;
      }
      lines.push(line);
      if (child.children && child.children.length > 0) {
        walk(child, depth + 1);
      }
    }
  }

  walk(root, 0);
  const mdContent = lines.join('\n');
  downloadBlob(new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' }), `${title}.md`);
}

// Parse Markdown into MindMapNode tree
export function importFromMarkdown(mdContent: string): MindMapNode {
  const lines = mdContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { id: generateId(), text: '导入的思维导图', children: [] };
  }

  // Find root title
  let rootText = '中心主题';
  let startIndex = 0;
  if (lines[0].startsWith('# ')) {
    rootText = lines[0].replace(/^#+\s*/, '').trim();
    startIndex = 1;
  }

  const root: MindMapNode = {
    id: generateId(),
    text: rootText,
    isExpanded: true,
    children: []
  };

  interface StackItem {
    node: MindMapNode;
    depth: number;
  }

  const stack: StackItem[] = [{ node: root, depth: -1 }];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    // Calculate indentation depth
    const leadingSpaces = rawLine.match(/^\s*/)?.[0].length || 0;
    const depth = Math.floor(leadingSpaces / 2);

    let cleanText = rawLine.trim().replace(/^[-*+]\s*/, '').replace(/^#+\s*/, '');
    let note: string | undefined;
    let link: string | undefined;

    // Parse note if any
    const noteMatch = cleanText.match(/<!--\s*备注:\s*(.*?)\s*-->/);
    if (noteMatch) {
      note = noteMatch[1];
      cleanText = cleanText.replace(noteMatch[0], '').trim();
    }

    // Parse link if any
    const linkMatch = cleanText.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (linkMatch) {
      link = linkMatch[1];
      cleanText = cleanText.replace(linkMatch[0], '').trim();
    }

    const newNode: MindMapNode = {
      id: generateId(),
      text: cleanText || '未命名主题',
      note,
      link,
      isExpanded: true,
      children: []
    };

    // Find parent with smaller depth
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);

    stack.push({ node: newNode, depth });
  }

  return root;
}

// Export as SVG
export function exportToSVG(
  nodes: LayoutNode[],
  connections: ConnectionCurve[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  theme: ThemeColors,
  title: string
): string {
  const padding = 60;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  svg += `<style>
    .node-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif; }
  </style>\n`;
  svg += `<rect width="100%" height="100%" fill="${theme.background}" />\n`;

  // Draw curves
  svg += `<g transform="translate(${offsetX}, ${offsetY})">\n`;
  for (const conn of connections) {
    svg += `  <path d="${conn.path}" fill="none" stroke="${conn.color}" stroke-width="${conn.strokeWidth}" stroke-linecap="round" />\n`;
  }

  // Draw nodes
  for (const n of nodes) {
    const rx = n.level === 0 ? 12 : (n.shape === 'pill' ? 16 : 8);
    const stroke = n.level === 0 ? 'none' : n.borderColor;
    const fill = n.level === 0 ? n.bgColor : theme.surface;

    svg += `  <g transform="translate(${n.x}, ${n.y})">\n`;
    svg += `    <rect width="${n.width}" height="${n.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))" />\n`;

    const fontSize = n.level === 0 ? 16 : (n.level === 1 ? 14 : 12);
    const fontWeight = n.level === 0 ? 'bold' : (n.level === 1 ? '600' : 'normal');
    const textColor = n.level === 0 ? n.textColor : theme.nodeText;
    const textY = n.height / 2 + (fontSize / 3);

    svg += `    <text x="${n.width / 2}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}" class="node-text">${escapeXml(n.node.text)}</text>\n`;
    svg += `  </g>\n`;
  }

  svg += `</g>\n`;
  svg += `</svg>`;

  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${title}.svg`);
  return svg;
}

// Export as PNG
export async function exportToPNG(
  nodes: LayoutNode[],
  connections: ConnectionCurve[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  theme: ThemeColors,
  title: string
): Promise<void> {
  const padding = 80;
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  const canvas = document.createElement('canvas');
  const dpr = 2; // High-DPI export
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // Connections
  for (const conn of connections) {
    ctx.strokeStyle = conn.color;
    ctx.lineWidth = conn.strokeWidth;
    ctx.lineCap = 'round';
    const p = new Path2D(conn.path);
    ctx.stroke(p);
  }

  // Nodes
  for (const n of nodes) {
    const rx = n.level === 0 ? 12 : 8;
    ctx.save();
    ctx.translate(n.x, n.y);

    // Box shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // Fill
    ctx.fillStyle = n.level === 0 ? n.bgColor : theme.surface;
    roundRect(ctx, 0, 0, n.width, n.height, rx);
    ctx.fill();

    // Border
    ctx.shadowColor = 'transparent';
    if (n.level > 0) {
      ctx.strokeStyle = n.borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Text
    const fontSize = n.level === 0 ? 16 : (n.level === 1 ? 14 : 12);
    ctx.font = `${n.level === 0 ? 'bold' : '500'} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = n.level === 0 ? n.textColor : theme.nodeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.node.text, n.width / 2, n.height / 2);

    ctx.restore();
  }

  ctx.restore();

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${title}.png`;
  a.click();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
