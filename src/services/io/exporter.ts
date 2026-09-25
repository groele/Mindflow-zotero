import { MindMapDocument, MindMapNode, LayoutNode, ConnectionCurve, ThemeColors, TaskInfo } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';

// Export as formatted JSON (supports both MindMapDocument and bare MindMapNode)
export function exportToJSON(data: MindMapDocument | MindMapNode, fallbackTitle = 'mindmap'): void {
  let doc: MindMapDocument;
  if ('root' in data && 'themeId' in data) {
    doc = data as MindMapDocument;
  } else {
    doc = {
      id: generateId(),
      title: fallbackTitle,
      root: data as MindMapNode,
      themeId: 'classic-light',
      layoutType: 'mindmap',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  const jsonStr = JSON.stringify(doc, null, 2);
  downloadBlob(new Blob([jsonStr], { type: 'application/json' }), `${doc.title}.mindflow.json`);
}

// Export to Markdown with task checkboxes and metadata
export function exportToMarkdown(root: MindMapNode, title: string): void {
  const lines: string[] = [`# ${root.text}\n`];

  function walk(node: MindMapNode, depth: number) {
    for (const child of node.children) {
      const indent = '  '.repeat(depth);
      let taskPrefix = '';
      if (child.task) {
        taskPrefix = child.task.status === 'done' ? '[x] ' : '[ ] ';
      }
      let line = `${indent}- ${taskPrefix}${child.text}`;
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

// Parse Markdown into MindMapNode tree (with task checkbox support)
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
    const leadingSpaces = rawLine.match(/^\s*/)?.[0].length || 0;
    const depth = Math.floor(leadingSpaces / 2);

    let cleanText = rawLine.trim().replace(/^[-*+]\s*/, '').replace(/^#+\s*/, '');
    let note: string | undefined;
    let link: string | undefined;
    let task: TaskInfo | undefined;

    // Checkbox support: [x] or [ ]
    if (/^\[x\]\s*/i.test(cleanText)) {
      task = { status: 'done' };
      cleanText = cleanText.replace(/^\[x\]\s*/i, '');
    } else if (/^\[\s*\]\s*/.test(cleanText)) {
      task = { status: 'todo' };
      cleanText = cleanText.replace(/^\[\s*\]\s*/, '');
    }

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
      task,
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

// ---------------- OPML 2.0 Import / Export ----------------

function renderOutline(node: MindMapNode, indent: string): string {
  const textAttr = `text="${escapeXml(node.text)}"`;
  const noteAttr = node.note ? ` _note="${escapeXml(node.note)}"` : '';
  const linkAttr = node.link ? ` url="${escapeXml(node.link)}"` : '';
  const statusAttr = node.task ? ` _status="${node.task.status}"` : '';

  if (!node.children || node.children.length === 0) {
    return `${indent}<outline ${textAttr}${noteAttr}${linkAttr}${statusAttr} />\n`;
  }

  let res = `${indent}<outline ${textAttr}${noteAttr}${linkAttr}${statusAttr}>\n`;
  for (const child of node.children) {
    res += renderOutline(child, indent + '  ');
  }
  res += `${indent}</outline>\n`;
  return res;
}

export function exportToOPML(root: MindMapNode, title: string): void {
  const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>
${renderOutline(root, '    ')}  </body>
</opml>`;

  downloadBlob(new Blob([opmlContent], { type: 'text/xml;charset=utf-8' }), `${title}.opml`);
}

export function parseOPMLString(xmlContent: string): MindMapNode {
  // If browser DOMParser is available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length === 0) {
        const body = xmlDoc.getElementsByTagName('body')[0];
        if (body) {
          const directOutlines = Array.from(body.children).filter(el => el.tagName.toLowerCase() === 'outline');
          if (directOutlines.length > 0) {
            function parseElement(el: Element): MindMapNode {
              const text = el.getAttribute('text') || el.getAttribute('title') || '未命名节点';
              const note = el.getAttribute('_note') || el.getAttribute('note') || undefined;
              const link = el.getAttribute('url') || el.getAttribute('xmlUrl') || undefined;
              const statusAttr = el.getAttribute('_status') || el.getAttribute('status');
              let task: TaskInfo | undefined;
              if (statusAttr === 'done' || statusAttr === 'completed') {
                task = { status: 'done' };
              } else if (statusAttr === 'doing') {
                task = { status: 'doing' };
              } else if (statusAttr === 'todo' || statusAttr === 'incomplete') {
                task = { status: 'todo' };
              }

              const childElements = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'outline');
              return {
                id: generateId(),
                text,
                note,
                link,
                task,
                isExpanded: true,
                children: childElements.map(parseElement)
              };
            }

            if (directOutlines.length === 1) {
              return parseElement(directOutlines[0]);
            } else {
              const titleEl = xmlDoc.getElementsByTagName('title')[0];
              const rootText = titleEl ? (titleEl.textContent || '思维导图') : '思维导图';
              return {
                id: generateId(),
                text: rootText,
                isExpanded: true,
                children: directOutlines.map(parseElement)
              };
            }
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Pure regex parser fallback (works reliably in Node.js unit tests and offline environments)
  const tagRegex = /<\/?outline(\s+[^>]*)?\/?>/gi;
  const roots: MindMapNode[] = [];
  const stack: MindMapNode[] = [];

  let match;
  while ((match = tagRegex.exec(xmlContent)) !== null) {
    const fullTag = match[0];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>');

    if (isClosing) {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }

    const attrsStr = match[1] || '';
    const getAttr = (name: string): string | undefined => {
      const r = new RegExp(`${name}=["']([^"']*)["']`, 'i');
      const m = attrsStr.match(r);
      return m ? unescapeXml(m[1]) : undefined;
    };

    const text = getAttr('text') || getAttr('title') || '未命名节点';
    const note = getAttr('_note') || getAttr('note');
    const link = getAttr('url') || getAttr('xmlUrl');
    const statusAttr = getAttr('_status') || getAttr('status');
    let task: TaskInfo | undefined;
    if (statusAttr === 'done' || statusAttr === 'completed') {
      task = { status: 'done' };
    } else if (statusAttr === 'doing') {
      task = { status: 'doing' };
    } else if (statusAttr === 'todo' || statusAttr === 'incomplete') {
      task = { status: 'todo' };
    }

    const newNode: MindMapNode = {
      id: generateId(),
      text,
      note,
      link,
      task,
      isExpanded: true,
      children: []
    };

    if (stack.length === 0) {
      roots.push(newNode);
    } else {
      const parent = stack[stack.length - 1];
      parent.children.push(newNode);
    }

    if (!isSelfClosing) {
      stack.push(newNode);
    }
  }

  if (roots.length === 1) {
    return roots[0];
  }

  const titleMatch = xmlContent.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? unescapeXml(titleMatch[1].trim()) : '思维导图';

  return {
    id: generateId(),
    text: title || '思维导图',
    isExpanded: true,
    children: roots
  };
}

export function importFromOPML(xmlContent: string): MindMapNode {
  return parseOPMLString(xmlContent);
}

// ---------------- SVG / PNG / HTML ----------------

export interface ExportOptions {
  watermark?: boolean;
  watermarkText?: string;
  highDpi?: boolean;
}

// Export as SVG
export function exportToSVG(
  nodes: LayoutNode[],
  connections: ConnectionCurve[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  theme: ThemeColors,
  title: string,
  options?: ExportOptions
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
  svg += `<rect width="100%" height="100%" fill="${escapeXml(safeColor(theme.background, '#ffffff'))}" />\n`;

  // Draw curves
  svg += `<g transform="translate(${offsetX}, ${offsetY})">\n`;
  for (const conn of connections) {
    svg += `  <path d="${escapeXml(conn.path)}" fill="none" stroke="${escapeXml(safeColor(conn.color, '#64748b'))}" stroke-width="${conn.strokeWidth}" stroke-linecap="round" />\n`;
  }

  // Draw nodes
  for (const n of nodes) {
    const rx = n.level === 0 ? 12 : (n.shape === 'pill' ? 16 : 8);
    const stroke = n.level === 0 ? 'none' : safeColor(n.borderColor, '#cbd5e1');
    const fill = n.level === 0 ? safeColor(n.bgColor, '#ffffff') : safeColor(theme.surface, '#ffffff');

    svg += `  <g transform="translate(${n.x}, ${n.y})">\n`;
    svg += `    <rect width="${n.width}" height="${n.height}" rx="${rx}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))" />\n`;

    const fontSize = n.level === 0 ? 16 : (n.level === 1 ? 14 : 12);
    const fontWeight = n.level === 0 ? 'bold' : (n.level === 1 ? '600' : 'normal');
    const textColor = n.level === 0 ? safeColor(n.textColor, '#0f172a') : safeColor(theme.nodeText, '#0f172a');
    const textY = n.height / 2 + (fontSize / 3);

    svg += `    <text x="${n.width / 2}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}" fill="${escapeXml(textColor)}" class="node-text">${escapeXml(n.node.text)}</text>\n`;
    svg += `  </g>\n`;
  }

  svg += `</g>\n`;

  // Optional Watermark
  if (options?.watermark) {
    const watermarkText = escapeXml(options.watermarkText || 'Created with MindFlow');
    const watermarkColor = theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    svg += `<text x="${width - 24}" y="${height - 20}" text-anchor="end" font-size="12" fill="${watermarkColor}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500">${watermarkText}</text>\n`;
  }

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
  title: string,
  options?: ExportOptions
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

  // Draw optional watermark
  if (options?.watermark) {
    ctx.save();
    ctx.font = '500 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = theme.isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(options.watermarkText || 'Created with MindFlow', width - 24, height - 20);
    ctx.restore();
  }

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${title}.png`;
  a.click();
}

// Export as Standalone Offline Interactive HTML
export function exportToInteractiveHTML(
  nodes: LayoutNode[],
  connections: ConnectionCurve[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  theme: ThemeColors,
  title: string,
  _options?: ExportOptions
): void {
  const padding = 100;
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  let curvesSvg = '';
  for (const conn of connections) {
    curvesSvg += `<path d="${escapeXml(conn.path)}" fill="none" stroke="${escapeXml(safeColor(conn.color, '#64748b'))}" stroke-width="${conn.strokeWidth}" stroke-linecap="round" />\n`;
  }

  let nodesSvg = '';
  for (const n of nodes) {
    const rx = n.level === 0 ? 12 : (n.shape === 'pill' ? 16 : 8);
    const stroke = n.level === 0 ? 'none' : safeColor(n.borderColor, '#cbd5e1');
    const fill = n.level === 0 ? safeColor(n.bgColor, '#ffffff') : safeColor(theme.surface, '#ffffff');
    const fontSize = n.level === 0 ? 16 : (n.level === 1 ? 14 : 12);
    const fontWeight = n.level === 0 ? 'bold' : (n.level === 1 ? '600' : 'normal');
    const textColor = n.level === 0 ? safeColor(n.textColor, '#0f172a') : safeColor(theme.nodeText, '#0f172a');
    const textY = n.height / 2 + (fontSize / 3);

    nodesSvg += `
    <g class="mind-node" transform="translate(${n.x}, ${n.y})">
      <rect width="${n.width}" height="${n.height}" rx="${rx}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))" />
      <text x="${n.width / 2}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}" fill="${escapeXml(textColor)}">${escapeXml(n.node.text)}</text>
    </g>`;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)} - MindFlow 交互导图</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: ${safeColor(theme.background, '#ffffff')}; color: ${safeColor(theme.text, '#0f172a')}; }
    #header {
      position: absolute; top: 16px; left: 16px; right: 16px; z-index: 10;
      display: flex; justify-content: space-between; align-items: center; pointer-events: none;
    }
    .header-card {
      background: ${safeColor(theme.surface, '#ffffff')}; padding: 8px 16px; border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1); pointer-events: auto; display: flex; align-items: center; gap: 12px;
    }
    .title { font-weight: 700; font-size: 16px; }
    .badge { font-size: 11px; background: rgba(59, 130, 246, 0.15); color: #3b82f6; padding: 2px 8px; border-radius: 9999px; font-weight: 600; }
    .controls { display: flex; gap: 8px; pointer-events: auto; }
    .btn {
      background: ${safeColor(theme.surface, '#ffffff')}; border: 1px solid rgba(125,125,125,0.2); color: ${safeColor(theme.text, '#0f172a')};
      padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.15s;
    }
    .btn:hover { background: rgba(125,125,125,0.1); }
    #canvas-container { width: 100%; height: 100%; cursor: grab; user-select: none; }
    #canvas-container:active { cursor: grabbing; }
    svg { width: 100%; height: 100%; display: block; }
    .node-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .mind-node { transition: transform 0.1s; }
  </style>
</head>
<body>
  <div id="header">
    <div class="header-card">
      <span class="title">${escapeXml(title)}</span>
      <span class="badge">${nodes.length} 节点</span>
    </div>
    <div class="controls">
      <button class="btn" onclick="zoomIn()">放大 (+)</button>
      <button class="btn" onclick="zoomOut()">缩小 (-)</button>
      <button class="btn" onclick="resetView()">重置视口</button>
    </div>
  </div>

  <div id="canvas-container">
    <svg id="svg-canvas" viewBox="0 0 ${width} ${height}">
      <g id="viewport" transform="translate(${offsetX}, ${offsetY}) scale(1)">
        ${curvesSvg}
        ${nodesSvg}
      </g>
    </svg>
  </div>

  <script>
    let scale = 1;
    let panX = ${offsetX};
    let panY = ${offsetY};
    let isDragging = false;
    let startX = 0, startY = 0;

    const viewport = document.getElementById('viewport');
    const container = document.getElementById('canvas-container');

    function updateTransform() {
      viewport.setAttribute('transform', 'translate(' + panX + ', ' + panY + ') scale(' + scale + ')');
    }

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(Math.max(0.2, scale * zoomFactor), 4);
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      panX = mouseX - (mouseX - panX) * (newScale / scale);
      panY = mouseY - (mouseY - panY) * (newScale / scale);
      scale = newScale;
      updateTransform();
    }, { passive: false });

    function zoomIn() {
      scale = Math.min(4, scale * 1.2);
      updateTransform();
    }
    function zoomOut() {
      scale = Math.max(0.2, scale / 1.2);
      updateTransform();
    }
    function resetView() {
      scale = 1;
      panX = ${offsetX};
      panY = ${offsetY};
      updateTransform();
    }
  </script>
</body>
</html>`;

  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), `${title}.html`);
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
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
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

function safeColor(value: string, fallback: string): string {
  const color = String(value || '').trim();
  const isHex = /^#[\da-f]{3,8}$/i.test(color);
  const isNamed = /^(transparent|none|black|white|red|green|blue|gray|grey|orange|purple)$/i.test(color);
  const isFunctional = /^(?:rgba?|hsla?)\([\d.,%\s/+-]+\)$/i.test(color);
  return isHex || isNamed || isFunctional ? color : fallback;
}

function unescapeXml(str: string): string {
  return (str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Print mind map to vector PDF with pure, clean landscape stylesheet
 */
export function printToPDF(): void {
  if (typeof window === 'undefined') return;

  const styleId = 'mindflow-print-styles';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      @media print {
        @page {
          size: landscape;
          margin: 10mm;
        }
        body {
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        header, nav, aside, .toolbar-container, .minimap-container, .command-palette, .modal-backdrop, button, .quick-micro-toolbar {
          display: none !important;
        }
        .canvas-container, main {
          position: static !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        .canvas-background {
          background-image: none !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  window.print();
}
