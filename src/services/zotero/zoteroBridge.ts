import { MindMapNode, MindMapDocument } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';

export interface ZoteroItemData {
  key: string;
  id?: number | string;
  title: string;
  itemType?: string;
  authors: string[];
  year?: string;
  publication?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  tags: string[];
  notes?: string[];
  annotations?: Array<{ text: string; comment?: string; pageLabel?: string; color?: string }>;
  zoteroUri: string;
}

declare global {
  interface Window {
    Zotero?: any;
    arguments?: any[];
  }
}

/**
 * Get the global Zotero object if running inside Zotero 7 / Firefox Gecko environment
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
 * Check if the application is running inside Zotero 7 desktop environment
 */
export function isZoteroEnvironment(): boolean {
  return getZoteroInstance() !== null;
}

/**
 * Extract item information from a live Zotero.Item object
 */
export function extractZoteroItemData(item: any): ZoteroItemData | null {
  try {
    if (!item) return null;
    // Ensure it's a regular item (not attachment/note alone, unless attachment has parent)
    const isRegular = typeof item.isRegularItem === 'function' ? item.isRegularItem() : true;
    if (!isRegular && typeof item.isNote === 'function' && !item.isNote()) {
      return null;
    }

    const title = (typeof item.getField === 'function' ? item.getField('title') : item.title) || '无标题文献';
    const date = typeof item.getField === 'function' ? item.getField('date') : item.date;
    let year = '';
    if (date) {
      const match = String(date).match(/\b(19|20)\d{2}\b/);
      year = match ? match[0] : String(date).slice(0, 4);
    }

    // Authors
    let authors: string[] = [];
    try {
      if (typeof item.getCreators === 'function') {
        const creators = item.getCreators();
        authors = creators.map((c: any) => c.lastName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean);
      } else if (Array.isArray(item.creators)) {
        authors = item.creators.map((c: any) => c.lastName || c.name || '').filter(Boolean);
      }
    } catch {
      // fallback
    }

    const publication = typeof item.getField === 'function' ? (item.getField('publicationTitle') || item.getField('proceedingsTitle') || item.getField('publisher')) : '';
    const doi = typeof item.getField === 'function' ? item.getField('DOI') : item.doi;
    const url = typeof item.getField === 'function' ? item.getField('url') : item.url;
    const abstract = typeof item.getField === 'function' ? item.getField('abstractNote') : item.abstractNote;

    // Tags
    let tags: string[] = [];
    try {
      if (typeof item.getTags === 'function') {
        tags = item.getTags().map((t: any) => t.tag || String(t)).filter(Boolean);
      } else if (Array.isArray(item.tags)) {
        tags = item.tags.map((t: any) => t.tag || String(t)).filter(Boolean);
      }
    } catch {
      // fallback
    }

    // Notes and annotations
    const notes: string[] = [];
    const annotations: Array<{ text: string; comment?: string; pageLabel?: string; color?: string }> = [];

    try {
      if (typeof item.getNotes === 'function') {
        const noteIds = item.getNotes();
        const Zotero = getZoteroInstance();
        if (Zotero && Array.isArray(noteIds)) {
          for (const noteId of noteIds) {
            const noteItem = Zotero.Items.get(noteId);
            if (noteItem) {
              const noteText = (noteItem.getNote() || '').replace(/<[^>]+>/g, '').trim();
              if (noteText) notes.push(noteText.slice(0, 300));
            }
          }
        }
      }

      // Attachments & Reader annotations
      if (typeof item.getAttachments === 'function') {
        const attIds = item.getAttachments();
        const Zotero = getZoteroInstance();
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
                    annotations.push({ text: text || '', comment, pageLabel, color });
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

    const key = item.key || String(item.id || Math.random());
    const zoteroUri = `zotero://select/items/${item.key || item.id}`;

    return {
      key,
      id: item.id,
      title,
      itemType: item.itemType || 'journalArticle',
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
 * Get selected items from Zotero client
 */
export function getSelectedZoteroItems(): ZoteroItemData[] {
  const Zotero = getZoteroInstance();
  if (!Zotero) return [];

  try {
    const pane = Zotero.getActiveZoteroPane?.() || (typeof window !== 'undefined' && (window as any).ZoteroPane);
    if (!pane) return [];

    const items = pane.getSelectedItems ? pane.getSelectedItems() : [];
    const results: ZoteroItemData[] = [];
    for (const item of items) {
      const data = extractZoteroItemData(item);
      if (data) results.push(data);
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
 * Set a MindFlow extension preference in Zotero.Prefs and broadcast to host
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
    const annoChildren: MindMapNode[] = item.annotations.slice(0, 10).map((anno) => ({
      id: generateId(),
      text: (anno.pageLabel ? `[P.${anno.pageLabel}] ` : '') + (anno.text || anno.comment || '批注'),
      note: anno.comment ? `批注说明: ${anno.comment}` : undefined,
      color: anno.color,
      children: [],
    }));
    children.push({
      id: generateId(),
      text: `✏️ 阅读批注 (${item.annotations.length})`,
      isExpanded: true,
      children: annoChildren,
    });
  }

  // 4. Notes
  if (includeAnnotations && item.notes && item.notes.length > 0) {
    const noteChildren: MindMapNode[] = item.notes.map((n) => ({
      id: generateId(),
      text: n.length > 80 ? `${n.slice(0, 80)}...` : n,
      note: n,
      children: [],
    }));
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
      item.abstract ? `\n摘要:\n${item.abstract}` : null,
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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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

    const noteItem = new Zotero.Item('note');
    noteItem.setNote(noteHtml);
    await noteItem.saveTx();

    return { success: true, message: `已成功保存到 Zotero 笔记库：“${doc.title}”` };
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
  const key = String(itemKeyOrUri).replace(/^.*\/items\//, '').trim();

  // 1. Send postMessage to host window (Zotero top-level)
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: 'MINDFLOW_LOCATE_ITEM',
        key,
      }, '*');
    } catch {
      // ignore
    }
  }

  // 2. Direct XPCOM invocation if accessible in current context
  if (Zotero) {
    try {
      const userLibId = Zotero.Libraries?.userLibraryID || 1;
      let item = null;
      if (/^\d+$/.test(key)) {
        item = Zotero.Items.get(Number(key));
      } else if (Zotero.Items.getByLibraryAndKey) {
        item = Zotero.Items.getByLibraryAndKey(userLibId, key);
      }

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

  return false;
}

/**
 * Open the PDF reader for a given Zotero item
 */
export function openItemPdfInZotero(itemKeyOrUri: string | number): boolean {
  const Zotero = getZoteroInstance();
  const key = String(itemKeyOrUri).replace(/^.*\/items\//, '').trim();

  // 1. Send postMessage to host window
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: 'MINDFLOW_OPEN_PDF',
        key,
      }, '*');
    } catch {
      // ignore
    }
  }

  // 2. Direct XPCOM invocation if accessible
  if (Zotero) {
    try {
      const userLibId = Zotero.Libraries?.userLibraryID || 1;
      let item = null;
      if (/^\d+$/.test(key)) {
        item = Zotero.Items.get(Number(key));
      } else if (Zotero.Items.getByLibraryAndKey) {
        item = Zotero.Items.getByLibraryAndKey(userLibId, key);
      }

      if (item) {
        let pdfAttachment: any = null;
        if (item.isAttachment && item.isAttachment() && item.isPDFAttachment && item.isPDFAttachment()) {
          pdfAttachment = item;
        } else if (typeof item.getBestAttachment === 'function') {
          pdfAttachment = item.getBestAttachment();
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
          Zotero.Reader.open({ itemID: pdfAttachment.id });
          return true;
        }
      }
    } catch (e) {
      console.warn('[MindFlow] openItemPdfInZotero direct call:', e);
    }
  }

  // Fallback to locating item
  return locateItemInZotero(key);
}

/**
 * Open / Navigate to a Zotero URI
 */
export function openZoteroUri(uri: string): void {
  if (uri.startsWith('zotero://select/items/')) {
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
