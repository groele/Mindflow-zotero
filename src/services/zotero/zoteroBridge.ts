import { MindMapNode, MindMapDocument } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';

export interface ZoteroItemData {
  key: string;
  id?: number | string;
  libraryID?: number;
  title: string;
  itemType?: string;
  authors: string[];
  year?: string;
  publication?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  tags: string[];
  notes?: Array<string | { text: string; uri?: string }>;
  annotations?: Array<{ text: string; comment?: string; pageLabel?: string; color?: string; uri?: string }>;
  zoteroUri: string;
}

declare global {
  interface Window {
    Zotero?: any;
    arguments?: any[];
  }
}

/**
 * Get the global Zotero object if running inside Zotero 10 / Gecko
 */
export function getZoteroInstance(): any | null {
  try {
    if (typeof window !== 'undefined') {
      if (window.arguments && window.arguments[0] && window.arguments[0].Zotero) {
        return window.arguments[0].Zotero;
      }
      if (window.opener && window.opener.Zotero) {
        return window.opener.Zotero;
      }
      if (window.parent && window.parent !== window && window.parent.Zotero) {
        return window.parent.Zotero;
      }
      if (window.Zotero) {
        return window.Zotero;
      }
    }
  } catch (e) {
    // Cross-origin or restricted access fallback
  }
  return null;
}

/**
 * Check if the application is running inside Zotero desktop
 */
export function isZoteroEnvironment(): boolean {
  return getZoteroInstance() !== null;
}

function noteHtmlToText(html: string): string {
  try {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    parsed.querySelectorAll('p, div, li').forEach((node) => node.append('\n'));
    return (parsed.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').trim();
  }
}

function annotationLink(attachment: any, annotation: any, Zotero: any): string | undefined {
  if (!annotation?.key || !attachment?.key) return undefined;
  const groupID = Zotero?.Libraries?.get?.(attachment.libraryID)?.groupID;
  const base = groupID
    ? `zotero://open-pdf/groups/${groupID}/items/${attachment.key}`
    : `zotero://open-pdf/library/items/${attachment.key}`;
  let page: number | undefined;
  try {
    const index = JSON.parse(annotation.annotationPosition || '{}').pageIndex;
    if (Number.isSafeInteger(index) && index >= 0) page = index + 1;
  } catch { /* annotation link still works without a page */ }
  return `${base}?${page ? `page=${page}&` : ''}annotation=${encodeURIComponent(annotation.key)}`;
}

function resolveZoteroItem(reference: string | number, Zotero: any): any | null {
  const raw = String(reference).trim();
  const group = raw.match(/^zotero:\/\/(?:select|open-pdf)\/groups\/(\d+)\/items\/([A-Za-z0-9_]+)/);
  const key = group?.[2] || raw.match(/\/items\/([A-Za-z0-9_]+)(?:[?#]|$)/)?.[1] || raw;
  if (!/^[A-Za-z0-9_]+$/.test(key)) return null;
  if (!raw.includes('/items/') && /^\d+$/.test(key)) return Zotero.Items.get(Number(key));
  let libraryID = Zotero.Libraries?.userLibraryID || 1;
  if (group) {
    libraryID = Zotero.Groups?.getLibraryIDFromGroupID?.(Number(group[1]));
    if (!libraryID) return null;
  }
  return Zotero.Items.getByLibraryAndKey?.(libraryID, key) || null;
}

/**
 * Extract item information from a live Zotero.Item object or pre-serialized item
 */
export function extractZoteroItemData(item: any): ZoteroItemData | null {
  try {
    if (!item) return null;

    // Fast-path: Already a structured ZoteroItemData
    if (item.key && item.title && Array.isArray(item.authors) && item.zoteroUri) {
      return item as ZoteroItemData;
    }

    const Zotero = getZoteroInstance();

    // Resolve child attachments and notes to their bibliographic parent. A
    // standalone note is not a literature item and must not become a map root.
    let target = item;
    const isChildItem = target && (
      (typeof target.isAttachment === 'function' && target.isAttachment()) ||
      (typeof target.isNote === 'function' && target.isNote())
    );
    if (isChildItem && target.parentItemID) {
      const parent = Zotero?.Items?.get?.(target.parentItemID);
      if (parent) target = parent;
    }

    // Zotero notes and attachments are not source literature items. Unknown
    // object shapes are rejected too; serialized descriptors were handled above.
    if (typeof target.isRegularItem !== 'function' || !target.isRegularItem()) {
      return null;
    }

    const title = (typeof target.getField === 'function' ? target.getField('title') : target.title) || '无标题文献';
    const date = typeof target.getField === 'function' ? target.getField('date') : target.date;
    let year = '';
    if (date) {
      const match = String(date).match(/\b(19|20)\d{2}\b/);
      year = match ? match[0] : String(date).slice(0, 4);
    }

    // Authors
    let authors: string[] = [];
    try {
      if (typeof target.getCreators === 'function') {
        const creators = target.getCreators();
        authors = creators.map((c: any) => c.lastName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean);
      } else if (Array.isArray(target.creators)) {
        authors = target.creators.map((c: any) => c.lastName || c.name || '').filter(Boolean);
      }
    } catch {
      // fallback
    }

    const publication = typeof target.getField === 'function' ? (target.getField('publicationTitle') || target.getField('proceedingsTitle') || target.getField('publisher')) : '';
    const doi = typeof target.getField === 'function' ? target.getField('DOI') : target.doi;
    const url = typeof target.getField === 'function' ? target.getField('url') : target.url;
    const abstract = typeof target.getField === 'function' ? target.getField('abstractNote') : target.abstractNote;

    // Tags
    let tags: string[] = [];
    try {
      if (typeof target.getTags === 'function') {
        tags = target.getTags().map((t: any) => t.tag || String(t)).filter(Boolean);
      } else if (Array.isArray(target.tags)) {
        tags = target.tags.map((t: any) => t.tag || String(t)).filter(Boolean);
      }
    } catch {
      // fallback
    }

    // Notes and annotations
    const notes: Array<{ text: string; uri?: string }> = [];
    const annotations: Array<{ text: string; comment?: string; pageLabel?: string; color?: string; uri?: string }> = [];

    try {
      if (typeof target.getNotes === 'function') {
        const noteIds = target.getNotes();
        if (Zotero && Array.isArray(noteIds)) {
          for (const noteId of noteIds) {
            const noteItem = Zotero.Items.get(noteId);
            if (noteItem) {
              const noteText = noteHtmlToText(noteItem.getNote() || '');
              if (noteText && !noteText.includes('MindFlow 导图大纲')) {
                const groupID = Zotero.Libraries?.get?.(noteItem.libraryID)?.groupID;
                notes.push({
                  text: noteText,
                  uri: groupID
                    ? `zotero://select/groups/${groupID}/items/${noteItem.key}`
                    : `zotero://select/library/items/${noteItem.key}`,
                });
              }
            }
          }
        }
      }

      // Attachments & Reader annotations
      if (typeof target.getAttachments === 'function') {
        const attIds = target.getAttachments();
        if (Zotero && Array.isArray(attIds)) {
          for (const attId of attIds) {
            const att = Zotero.Items.get(attId);
            if (att && att.isPDFAttachment && att.isPDFAttachment()) {
              if (typeof att.getAnnotations === 'function') {
                const annos = att.getAnnotations();
                for (const anno of annos) {
                  const text = anno.annotationText;
                  const comment = anno.annotationComment;
                  const pageLabel = anno.annotationPageLabel;
                  const color = anno.annotationColor;
                  if (text || comment) {
                    annotations.push({ text: text || '', comment, pageLabel, color, uri: annotationLink(att, anno, Zotero) });
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore reading child notes
    }

    const key = target.key || String(target.id || Math.random());
    const groupID = Zotero?.Libraries?.get?.(target.libraryID)?.groupID;
    const zoteroUri = groupID
      ? `zotero://select/groups/${groupID}/items/${target.key || target.id}`
      : `zotero://select/library/items/${target.key || target.id}`;

    return {
      key,
      id: target.id,
      libraryID: target.libraryID,
      title,
      itemType: target.itemType || 'journalArticle',
      authors,
      year,
      publication,
      doi,
      url,
      abstract,
      tags,
      notes,
      annotations,
      zoteroUri,
    };
  } catch (error) {
    console.error('Failed to extract Zotero item:', error);
    return null;
  }
}

/**
 * Get selected items from Zotero client across all possible window scopes
 */
export function getSelectedZoteroItems(): ZoteroItemData[] {
  const Zotero = getZoteroInstance();
  if (!Zotero) return [];

  try {
    const mainWin = Zotero.getMainWindow ? Zotero.getMainWindow() : null;
    const pane =
      (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) ||
      mainWin?.ZoteroPane ||
      (typeof window !== 'undefined' && (window.parent as any)?.ZoteroPane) ||
      (typeof window !== 'undefined' && (window.opener as any)?.ZoteroPane) ||
      (typeof window !== 'undefined' && (window as any).ZoteroPane);

    if (!pane) return [];

    const items = pane.getSelectedItems ? pane.getSelectedItems() : [];
    const results: ZoteroItemData[] = [];
    for (const item of items) {
      let target = item;
      // Resolve attachment to parent
      if (target && typeof target.isAttachment === 'function' && target.isAttachment() && target.parentItemID) {
        const parent = Zotero.Items?.get?.(target.parentItemID);
        if (parent) target = parent;
      }
      const data = extractZoteroItemData(target);
      if (data && !results.some((r) => r.key === data.key && r.libraryID === data.libraryID)) {
        results.push(data);
      }
    }
    return results;
  } catch (error) {
    console.error('Failed to get selected Zotero items:', error);
    return [];
  }
}

/**
 * Get a MindFlow extension preference from Zotero.Prefs
 */
export function getZoteroPref<T>(key: string, defaultValue: T): T {
  const zotero = getZoteroInstance();
  if (zotero && zotero.Prefs) {
    try {
      const val = zotero.Prefs.get(`extensions.mindflow.${key}`, true);
      return val !== undefined ? (val as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

/**
 * Set a MindFlow extension preference in Zotero.Prefs, using the host bridge
 * only when this frame cannot access the Zotero preference API.
 */
export function setZoteroPref(key: string, value: any): boolean {
  const zotero = getZoteroInstance();
  let saved = false;
  if (zotero && zotero.Prefs) {
    try {
      zotero.Prefs.set(`extensions.mindflow.${key}`, value, true);
      saved = true;
    } catch {
      saved = false;
    }
  }
  if (!saved) {
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'MINDFLOW_SET_PREF',
            key,
            value,
          },
          '*'
        );
        saved = true;
      }
    } catch {
      // ignore
    }
  }
  return saved;
}

/**
 * Request host window to switch between Native Tab and Standalone Window
 */
export function requestZoteroWindowMode(targetMode: 'tab' | 'window'): void {
  setZoteroPref('windowMode', targetMode);
  try {
    if (typeof window !== 'undefined') {
      const zotero = getZoteroInstance();
      if (zotero?.MindFlow?.openMindFlow) {
        zotero.MindFlow.openMindFlow({ targetMode });
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'MINDFLOW_SET_WINDOW_MODE',
            targetMode,
          },
          '*'
        );
      }
    }
  } catch (e) {
    console.warn('[MindFlow] Note on requestZoteroWindowMode:', e);
  }
}

export interface ConvertZoteroOptions {
  includeAbstract?: boolean;
  includeAnnotations?: boolean;
  includeTags?: boolean;
}

/**
 * Convert a ZoteroItemData into a structured MindMapNode branch
 */
export function convertZoteroItemToNode(
  item: ZoteroItemData,
  options?: ConvertZoteroOptions
): MindMapNode {
  const includeAbstract = options?.includeAbstract ?? getZoteroPref('includeAbstract', true);
  const includeAnnotations = options?.includeAnnotations ?? getZoteroPref('includeAnnotations', true);
  const includeTags = options?.includeTags ?? getZoteroPref('includeTags', true);

  const authorSnippet = item.authors.length > 0
    ? (item.authors.length > 2 ? `${item.authors[0]} 等` : item.authors.join(' & '))
    : '';
  const yearSnippet = item.year ? `(${item.year})` : '';
  const headerParts = [yearSnippet, item.title, authorSnippet].filter(Boolean).join(' ');

  const children: MindMapNode[] = [];

  // 1. Publication & Metadata
  if (item.publication || item.doi) {
    const metaChildren: MindMapNode[] = [];
    if (item.publication) {
      metaChildren.push({
        id: generateId(),
        text: `期刊/来源: ${item.publication}`,
        children: [],
      });
    }
    if (item.doi) {
      metaChildren.push({
        id: generateId(),
        text: `DOI: ${item.doi}`,
        link: `https://doi.org/${item.doi}`,
        children: [],
      });
    }
    children.push({
      id: generateId(),
      text: '📚 出版信息',
      isExpanded: true,
      children: metaChildren,
    });
  }

  // 2. Abstract
  if (includeAbstract && item.abstract) {
    children.push({
      id: generateId(),
      text: '💡 核心摘要',
      note: item.abstract,
      isExpanded: false,
      children: [
        {
          id: generateId(),
          text: item.abstract.length > 120 ? `${item.abstract.slice(0, 120)}...` : item.abstract,
          note: item.abstract,
          children: [],
        },
      ],
    });
  }

  // 3. Annotations & Highlights
  if (includeAnnotations && item.annotations && item.annotations.length > 0) {
    const annoChildren: MindMapNode[] = item.annotations.map((anno) => ({
      id: generateId(),
      text: (anno.pageLabel ? `[P.${anno.pageLabel}] ` : '') + ((anno.text || anno.comment || '批注').slice(0, 160)),
      note: [anno.text, anno.comment ? `批注说明: ${anno.comment}` : ''].filter(Boolean).join('\n\n'),
      link: anno.uri,
      color: anno.color,
      children: [],
    }));
    children.push({
      id: generateId(),
      text: `✏️ 阅读批注 (${item.annotations.length})`,
      isExpanded: false,
      children: annoChildren,
    });
  }

  // 4. Notes
  if (includeAnnotations && item.notes && item.notes.length > 0) {
    const noteChildren: MindMapNode[] = item.notes.map((entry) => {
      const text = typeof entry === 'string' ? entry : entry.text;
      return {
      id: generateId(),
      text: text.length > 80 ? `${text.slice(0, 80)}...` : text,
      note: text,
      link: typeof entry === 'string' ? undefined : entry.uri,
      children: [],
      };
    });
    children.push({
      id: generateId(),
      text: `📝 关联笔记 (${item.notes.length})`,
      isExpanded: true,
      children: noteChildren,
    });
  }

  // 5. Tags
  if (includeTags && item.tags && item.tags.length > 0) {
    children.push({
      id: generateId(),
      text: `🏷️ 标签: ${item.tags.join(', ')}`,
      tags: item.tags,
      children: [],
    });
  }

  return {
    id: generateId(),
    text: headerParts || item.title,
    note: [
      `标题: ${item.title}`,
      item.authors.length ? `作者: ${item.authors.join(', ')}` : null,
      item.publication ? `刊物: ${item.publication}` : null,
      item.year ? `年代: ${item.year}` : null,
      item.doi ? `DOI: ${item.doi}` : null,
      includeAbstract && item.abstract ? `\n摘要:\n${item.abstract}` : null,
    ].filter(Boolean).join('\n'),
    link: item.zoteroUri,
    tags: item.tags.length ? item.tags.slice(0, 3) : undefined,
    color: '#0284c7', // sleek academic blue accent
    isExpanded: true,
    children,
  };
}

/**
 * Save MindMapDocument outline back into Zotero as an HTML note
 */
export async function saveMindMapToZoteroNote(doc: MindMapDocument): Promise<{ success: boolean; message: string }> {
  const Zotero = getZoteroInstance();
  if (!Zotero) {
    return { success: false, message: '未检测到 Zotero 运行环境，无法直接存入 Zotero 笔记' };
  }

  try {
    const parentReference = doc.metadata?.zoteroUri || doc.metadata?.zoteroItemKey;
    const parentItem = parentReference ? resolveZoteroItem(parentReference, Zotero) : null;
    if (parentReference && (!parentItem || !parentItem.isRegularItem?.())) {
      return { success: false, message: '关联的 Zotero 文献已不可用，未创建独立笔记以免丢失文献关联。' };
    }
    if (parentItem && Zotero.Libraries?.get?.(parentItem.libraryID)?.editable === false) {
      return { success: false, message: '目标 Zotero 文献库为只读，无法保存子笔记。' };
    }
    function nodeToHtml(node: MindMapNode, level: number = 1): string {
      const indent = '  '.repeat(level);
      let html = `${indent}<li><strong>${escapeHtml(node.text)}</strong>`;
      if (node.link) {
        html += ` <a href="${escapeHtml(node.link)}">[链接]</a>`;
      }
      if (node.note) {
        html += `<br/><small style="color: #64748b;">${escapeHtml(node.note)}</small>`;
      }
      if (node.tags && node.tags.length > 0) {
        html += ` <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${node.tags.map(escapeHtml).join(', ')}</span>`;
      }
      if (node.children && node.children.length > 0) {
        html += `\n${indent}<ul>\n`;
        for (const child of node.children) {
          html += nodeToHtml(child, level + 1);
        }
        html += `${indent}</ul>\n${indent}`;
      }
      html += `</li>\n`;
      return html;
    }

    function escapeHtml(str: string): string {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    const noteHtml = `
      <div data-mindflow-document-id="${escapeHtml(doc.id)}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2 style="color: #0284c7;">🧠 MindFlow 导图笔记: ${escapeHtml(doc.title)}</h2>
        <p style="color: #64748b; font-size: 12px;">创建时间: ${new Date(doc.createdAt).toLocaleString()} | 更新时间: ${new Date(doc.updatedAt).toLocaleString()}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
        <ul>
          ${nodeToHtml(doc.root)}
        </ul>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">由 MindFlow for Zotero 自动生成</p>
      </div>
    `.trim();

    let noteItem: any = null;
    if (parentItem && typeof parentItem.getNotes === 'function') {
      for (const noteID of parentItem.getNotes()) {
        const candidate = Zotero.Items.get(noteID);
        if (candidate?.isNote?.() && candidate.getNote?.().includes(`data-mindflow-document-id="${escapeHtml(doc.id)}"`)) {
          noteItem = candidate;
          break;
        }
      }
    }
    if (!noteItem) {
      noteItem = new Zotero.Item('note');
      if (parentItem) {
        noteItem.libraryID = parentItem.libraryID;
        noteItem.parentItemID = parentItem.id;
      }
    }
    noteItem.setNote(noteHtml);
    await noteItem.saveTx();
    if (getZoteroPref('autoOpenAfterExport', false)) {
      try {
        const pane = Zotero.getActiveZoteroPane?.() || Zotero.getMainWindow?.()?.ZoteroPane;
        await pane?.selectItem?.(noteItem.id);
      } catch { /* the note has already been saved */ }
    }

    return { success: true, message: parentItem
      ? `已将导图大纲保存为“${parentItem.getField('title')}”的子笔记`
      : `已将导图大纲保存为 Zotero 独立笔记：“${doc.title}”` };
  } catch (error: any) {
    console.error('Failed to save to Zotero note:', error);
    return { success: false, message: `保存失败: ${error?.message || error}` };
  }
}

/**
 * Locate and highlight an item in the Zotero library pane
 */
export function locateItemInZotero(itemKeyOrUri: string | number): boolean {
  const Zotero = getZoteroInstance();

  // Prefer a direct Zotero API call. Sending both this and a host message
  // selects the same item twice and can race tab switching.
  if (Zotero) {
    try {
      const item = resolveZoteroItem(itemKeyOrUri, Zotero);

      const win = (typeof window !== 'undefined' && window.parent !== window ? window.parent : null) || Zotero.getMainWindow?.();
      if (win?.Zotero_Tabs) {
        const libTab = win.Zotero_Tabs._tabs?.find((t: any) => t && (t.type === 'library' || t.id === 'zotero-pane'));
        if (libTab) win.Zotero_Tabs.select(libTab.id);
      }
      if (item && win?.ZoteroPane) {
        win.ZoteroPane.selectItem(item.id);
        return true;
      }
    } catch (e) {
      console.warn('[MindFlow] locateItemInZotero direct call:', e);
    }
  }

  // In an iframe without direct Zotero access, delegate to the host window.
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'MINDFLOW_LOCATE_ITEM', key: itemKeyOrUri }, '*');
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Open the PDF reader for a given Zotero item
 */
export function openItemPdfInZotero(itemKeyOrUri: string | number): boolean {
  const Zotero = getZoteroInstance();

  // Prefer a direct Zotero API call. Do not also ask the host to open a
  // second reader for the same item.
  if (Zotero) {
    try {
      const item = resolveZoteroItem(itemKeyOrUri, Zotero);

      if (item) {
        let pdfAttachment: any = null;
        if (item.isAttachment && item.isAttachment() && item.isPDFAttachment && item.isPDFAttachment()) {
          pdfAttachment = item;
        } else if (typeof item.getAttachments === 'function') {
          const attIds = item.getAttachments();
          for (const attId of attIds) {
            const att = Zotero.Items.get(attId);
            if (att && att.isPDFAttachment && att.isPDFAttachment()) {
              pdfAttachment = att;
              break;
            }
          }
        }

        if (pdfAttachment && Zotero.Reader && typeof Zotero.Reader.open === 'function') {
          void Promise.resolve(Zotero.Reader.open({ itemID: pdfAttachment.id })).catch((error) => {
            console.warn('[MindFlow] PDF reader opening failed:', error);
          });
          return true;
        }
      }
    } catch (e) {
      console.warn('[MindFlow] openItemPdfInZotero direct call:', e);
    }
  }

  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'MINDFLOW_OPEN_PDF', key: itemKeyOrUri }, '*');
      return true;
    } catch {
      // ignore
    }
  }

  // Fallback to locating item
  return locateItemInZotero(itemKeyOrUri);
}

/**
 * Open / Navigate to a Zotero URI
 */
export function openZoteroUri(uri: string): void {
  if (uri.startsWith('zotero://select/') && uri.includes('/items/')) {
    if (locateItemInZotero(uri)) return;
  }

  const Zotero = getZoteroInstance();
  if (Zotero && typeof Zotero.launchURL === 'function') {
    Zotero.launchURL(uri);
    return;
  }
  if (typeof window !== 'undefined') {
    window.location.href = uri;
  }
}

/**
 * High-quality sample literature data for browser development & demonstration
 */
export function getSampleAcademicItems(): ZoteroItemData[] {
  return [
    {
      key: 'item1',
      title: 'Attention Is All You Need: The Transformer Architecture',
      authors: ['Vaswani', 'Shazeer', 'Parmar', 'Uszkoreit', 'Jones', 'Gomez', 'Kaiser', 'Polosukhin'],
      year: '2017',
      publication: 'Advances in Neural Information Processing Systems (NeurIPS)',
      doi: '10.48550/arXiv.1706.03762',
      url: 'https://arxiv.org/abs/1706.03762',
      abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, a model architecture eschewing recurrence and entirely relying on an attention mechanism to draw global dependencies.',
      tags: ['Transformer', 'Deep Learning', 'Attention Mechanism', 'NLP'],
      annotations: [
        { text: 'Multi-Head Attention allows the model to jointly attend to information from different representation subspaces.', pageLabel: '4', color: '#ffea79' },
        { text: 'Positional Encoding is injected to provide information about relative or absolute position.', pageLabel: '6', color: '#ff6666' }
      ],
      notes: ['核心突破：抛弃 RNN/CNN 循环结构，实现全注意力机制并行训练。'],
      zoteroUri: 'zotero://select/items/0_SAMPLE1',
    },
    {
      key: 'item2',
      title: 'Deep Residual Learning for Image Recognition (ResNet)',
      authors: ['He', 'Zhang', 'Ren', 'Sun'],
      year: '2016',
      publication: 'IEEE Conference on Computer Vision and Pattern Recognition (CVPR)',
      doi: '10.1109/CVPR.2016.90',
      url: 'https://arxiv.org/abs/1512.03385',
      abstract: 'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.',
      tags: ['Computer Vision', 'ResNet', 'Residual Connection'],
      annotations: [
        { text: 'We explicitly let these layers fit a residual mapping: F(x) := H(x) - x.', pageLabel: '2', color: '#5fb236' }
      ],
      notes: ['残差跳连机制解决了深度神经网络中的退化问题（Degradation Problem）。'],
      zoteroUri: 'zotero://select/items/0_SAMPLE2',
    }
  ];
}

/**
 * Open Zotero Preferences / Settings Window (Focusing on MindFlow Plugin Settings)
 */
export function openZoteroPreferences(): boolean {
  // Prefer direct Zotero API access; dispatching both paths can open two
  // Preferences windows from the same click.
  const Zotero = getZoteroInstance();
  if (Zotero) {
    try {
      if (typeof Zotero.openPreferences === 'function') {
        Zotero.openPreferences('mindflow@groele.org');
        return true;
      }
      const win =
        (typeof window !== 'undefined' && window.parent !== window ? window.parent : null) ||
        Zotero.getMainWindow?.();
      if (win && typeof win.openDialog === 'function') {
        win.openDialog(
          'chrome://zotero/content/preferences/preferences.xhtml',
          'preferences',
          'chrome,titlebar,toolbar,centerscreen,resizable=yes',
          { pane: 'mindflow@groele.org' }
        );
        return true;
      }
      if (win && typeof win.goDoCommand === 'function') {
        win.goDoCommand('cmd_preferences');
        return true;
      }
    } catch (e) {
      console.warn('[MindFlow] openZoteroPreferences direct call note:', e);
    }
  }

  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'MINDFLOW_OPEN_PREFERENCES' }, '*');
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Save MindMapDocument directly as a Zotero child attachment (.mindflow) and outline note under a literature item
 */
export async function saveMindMapToZoteroAttachment(
  doc: MindMapDocument,
  parentItemKeyOrOptions?: string | { silent?: boolean },
  options?: { silent?: boolean }
): Promise<{ success: boolean; message: string; savedPath?: string }> {
  let targetKey: string | undefined;
  let opts: { silent?: boolean } | undefined = options;

  if (typeof parentItemKeyOrOptions === 'object' && parentItemKeyOrOptions !== null) {
    opts = parentItemKeyOrOptions;
    targetKey = doc.metadata?.zoteroItemKey;
  } else {
    targetKey = parentItemKeyOrOptions || doc.metadata?.zoteroItemKey;
  }

  // Prefer a direct call when Zotero's plugin API is available. Sending both
  // a direct call and a host message can archive the same document twice.
  const Zotero = getZoteroInstance();
  if (Zotero?.MindFlow?.saveMindMapToItem) {
    try {
      return await Zotero.MindFlow.saveMindMapToItem({
        doc,
        parentItemKey: targetKey,
        silent: opts?.silent,
      });
    } catch (e: any) {
      console.warn('[MindFlow] saveMindMapToZoteroAttachment direct call error:', e);
      return { success: false, message: `保存失败: ${e?.message || e}` };
    }
  }

  // In native tabs, the Zotero window owns the API while the app runs in an
  // iframe. Wait for the host's result so the UI does not report a save before
  // Zotero has actually written the attachment/note.
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    const requestId = `mindflow-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      const finish = (result: { success: boolean; message: string; savedPath?: string }) => {
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timeout);
        resolve(result);
      };
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const data = event.data;
        if (data?.type !== 'MINDFLOW_SAVE_ATTACHMENT_RESULT' || data.requestId !== requestId) return;
        finish(data.result || { success: false, message: 'Zotero 未返回归档结果' });
      };
      const timeout = window.setTimeout(() => {
        finish({ success: false, message: '等待 Zotero 归档结果超时，请检查 Zotero 错误日志后重试' });
      }, 30000);
      window.addEventListener('message', onMessage);
      try {
        window.parent.postMessage(
          {
            type: 'MINDFLOW_SAVE_ATTACHMENT',
            requestId,
            doc,
            parentItemKey: targetKey,
            silent: opts?.silent,
          },
          '*'
        );
      } catch {
        finish({ success: false, message: '无法向 Zotero 主窗口发送归档请求' });
      }
    });
  }

  return {
    success: false,
    message: '未检测到可用的 Zotero 插件通信通道，导图尚未归档。',
  };
}
