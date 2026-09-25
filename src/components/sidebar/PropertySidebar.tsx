import React, { useState, useEffect, useRef } from 'react';
import { MindMapDocument, MindMapNode, NodeShape, TaskStatus } from '../../core/model/types';
import { safeExternalUrl } from '../../core/model/links';
import { imageDisplayHeight, isSafeNodeImage } from '../../core/model/nodeImage';
import { DocumentSummary, StorageService } from '../../services/storage/storageService';
import {
  X, Tag, Link, FileText, Palette, Shapes,
  Star, Flag, CheckCircle2, HelpCircle, Plus, ListTodo, Link2, ImagePlus, Trash2,
  MapPin, BookOpen, GraduationCap, RefreshCw, Check
} from 'lucide-react';
import { locateItemInZotero, openItemPdfInZotero, saveMindMapToZoteroAttachment } from '../../services/zotero/zoteroBridge';

interface PropertySidebarProps {
  selectedNode: MindMapNode | null;
  currentDoc: MindMapDocument;
  onUpdateNode: (id: string, patch: Partial<MindMapNode>) => void;
  onImportImage: (id: string, file: File) => Promise<void>;
  onOpenInternalLink?: (documentId: string, nodeId?: string) => void;
  onClose: () => void;
  dockSide?: 'left' | 'right';
  defaultTaskPriority?: 1 | 2 | 3;
}

const COLOR_PRESETS = [
  '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777',
  '#9333ea', '#4f46e5', '#334155', '#475569'
];

export const PropertySidebar: React.FC<PropertySidebarProps> = ({
  selectedNode,
  currentDoc,
  onUpdateNode,
  onImportImage,
  onOpenInternalLink,
  onClose,
  dockSide = 'right',
  defaultTaskPriority = 2,
}) => {
  const [noteText, setNoteText] = useState('');
  const [nodeText, setNodeText] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [linkText, setLinkText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [linkError, setLinkError] = useState('');
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [targetNodes, setTargetNodes] = useState<Array<{ id: string; text: string; depth: number }>>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [isSyncingToZotero, setIsSyncingToZotero] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => StorageService.getDocumentList()
      .then(list => { if (active) setDocuments(list); })
      .catch(() => { if (active) setDocuments([]); });
    void refresh();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes.mindflow_docs_index) void refresh();
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.addListener(listener);
    return () => {
      active = false;
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.removeListener(listener);
    };
  }, [currentDoc.id]);

  useEffect(() => {
    const documentId = selectedNode?.internalLink?.documentId;
    if (!documentId) { setTargetNodes([]); return; }
    let active = true;
    const load = async () => {
      const targetDoc = documentId === currentDoc.id
        ? currentDoc
        : await StorageService.getDocument(documentId, { trackRevision: false });
      if (!active) return;
      if (!targetDoc) { setTargetNodes([]); return; }
      const nodes: Array<{ id: string; text: string; depth: number }> = [];
      const pending = [{ node: targetDoc.root, depth: 0 }];
      while (pending.length) {
        const { node, depth } = pending.pop()!;
        nodes.push({ id: node.id, text: node.text, depth });
        for (let i = node.children.length - 1; i >= 0; i -= 1) pending.push({ node: node.children[i], depth: depth + 1 });
      }
      setTargetNodes(nodes);
    };
    load().catch(() => { if (active) setTargetNodes([]); });
    return () => { active = false; };
  }, [selectedNode?.internalLink?.documentId, currentDoc.id, currentDoc.root]);

  useEffect(() => {
    if (selectedNode) {
      setNoteText(selectedNode.note || '');
      setImageError('');
      setLinkText(selectedNode.link || '');
      setLinkError('');
      setTargetSearch('');
    }
  }, [selectedNode?.id]);

  useEffect(() => { setNodeText(selectedNode?.text || ''); }, [selectedNode?.id, selectedNode?.text]);

  if (!selectedNode) return null;
  const nodeImage = isSafeNodeImage(selectedNode.image) ? selectedNode.image : null;

  const handleShapeChange = (shape: NodeShape) => {
    onUpdateNode(selectedNode.id, { shape });
  };

  const handleColorChange = (color: string) => {
    onUpdateNode(selectedNode.id, { color });
  };

  const handleNoteBlur = () => {
    onUpdateNode(selectedNode.id, { note: noteText.trim() || undefined });
  };

  const handleLinkBlur = () => {
    const trimmed = linkText.trim();
    if (trimmed && !safeExternalUrl(trimmed)) {
      setLinkError('仅支持 HTTPS、HTTP、mailto 或 zotero 链接');
      return;
    }
    setLinkError('');
    onUpdateNode(selectedNode.id, { link: trimmed || undefined });
  };

  const handleAddTag = () => {
    const trimmed = newTagText.trim();
    if (!trimmed) return;
    const currentTags = selectedNode.tags || [];
    if (!currentTags.includes(trimmed)) {
      onUpdateNode(selectedNode.id, { tags: [...currentTags, trimmed] });
    }
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = selectedNode.tags || [];
    onUpdateNode(selectedNode.id, {
      tags: currentTags.filter(t => t !== tagToRemove)
    });
  };

  const toggleIcon = (iconName: string) => {
    const currentIcons = selectedNode.icons || [];
    if (currentIcons.includes(iconName)) {
      onUpdateNode(selectedNode.id, {
        icons: currentIcons.filter(i => i !== iconName)
      });
    } else {
      onUpdateNode(selectedNode.id, {
        icons: [...currentIcons, iconName]
      });
    }
  };

  const currentIcons = selectedNode.icons || [];
  const noteRows = Math.min(18, Math.max(4, noteText.split('\n').reduce(
    (rows, line) => rows + Math.max(1, Math.ceil(line.length / 42)),
    0
  )));

  return (
    <aside className={`w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800 flex flex-col h-full z-20 select-none shadow-xl ${dockSide === 'left' ? 'border-r order-first animate-in slide-in-from-left duration-150' : 'border-l order-last animate-in slide-in-from-right duration-150'}`}>
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          主题样式与属性
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-700 dark:text-slate-300">
        <div className="space-y-2">
          <label htmlFor="node-text" className="font-medium text-slate-500">节点文字</label>
          <input id="node-text" value={nodeText} onChange={event => setNodeText(event.target.value)}
            onBlur={() => { if (nodeText !== selectedNode.text) onUpdateNode(selectedNode.id, { text: nodeText }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            placeholder="可为空，保留纯图片节点"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400" />
        </div>

        <div className="space-y-2 p-2.5 rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20">
          <label className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300"><ImagePlus className="w-3.5 h-3.5" /> 节点图片</label>
          <p className="text-[10px] text-slate-500">支持 PNG、JPEG、WebP；可将图片拖到画布节点，或选中节点后粘贴截图。导入时自动压缩并保存。</p>
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="选择节点图片"
            onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setImageBusy(true);
              setImageError('');
              try { await onImportImage(selectedNode.id, file); }
              catch (error: any) { setImageError(error?.message || '图片导入失败'); }
              finally { setImageBusy(false); }
            }} />
          {nodeImage && <>
            <img src={nodeImage.dataUrl} alt={selectedNode.text || '节点图片预览'}
              style={{ maxHeight: 150 }} className="max-w-full mx-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700" />
            <div className="flex items-center justify-between text-[11px]"><span>显示宽度</span><span>{nodeImage.width} px · 高约 {imageDisplayHeight(nodeImage)} px</span></div>
            <input type="range" min="80" max="480" step="10" value={nodeImage.width} aria-label="调整节点图片宽度"
              onChange={event => onUpdateNode(selectedNode.id, { image: { ...nodeImage, width: Number(event.target.value) } })}
              className="w-full accent-violet-600" />
          </>}
          {selectedNode.image && !nodeImage && <p role="alert" className="text-[11px] text-red-600">此节点图片数据无效，可替换或删除。</p>}
          <div className="flex gap-2">
            <button type="button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-50">{imageBusy ? '处理中…' : selectedNode.image ? '替换图片' : '导入图片'}</button>
            {selectedNode.image && <button type="button" onClick={() => onUpdateNode(selectedNode.id, { image: undefined, type: selectedNode.type === 'image' ? 'topic' : selectedNode.type })}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> 删除图片</button>}
          </div>
          {imageError && <p role="alert" className="text-[11px] text-red-600">{imageError}</p>}
        </div>

        {/* Node Shape */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Shapes className="w-3.5 h-3.5" /> 节点形状
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['rounded', 'pill', 'rectangle', 'underline'] as NodeShape[]).map((shape) => (
              <button
                key={shape}
                onClick={() => handleShapeChange(shape)}
                className={`py-1.5 text-center text-[11px] rounded-lg border transition-all ${
                  (selectedNode.shape || 'rounded') === shape
                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {shape === 'rounded' ? '圆角' : shape === 'pill' ? '胶囊' : shape === 'rectangle' ? '矩形' : '下划线'}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Palette className="w-3.5 h-3.5" /> 分支与高亮颜色
          </label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                  selectedNode.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                }`}
              />
            ))}
          </div>
        </div>

        {/* Priority & Status Badges */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-2">
            <Star className="w-3.5 h-3.5" /> 图标徽章
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => toggleIcon('priority-1')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-1') ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P1
            </button>
            <button
              onClick={() => toggleIcon('priority-2')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-2') ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P2
            </button>
            <button
              onClick={() => toggleIcon('priority-3')}
              className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                currentIcons.includes('priority-3') ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-700'
              }`}
            >
              P3
            </button>
            <button
              onClick={() => toggleIcon('star')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('star') ? 'bg-amber-100 border-amber-400 text-amber-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('flag')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('flag') ? 'bg-red-100 border-red-400 text-red-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('check')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('check') ? 'bg-emerald-100 border-emerald-400 text-emerald-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleIcon('question')}
              className={`p-1.5 rounded border transition-colors ${
                currentIcons.includes('question') ? 'bg-sky-100 border-sky-400 text-sky-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Management */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <ListTodo className="w-3.5 h-3.5 text-blue-600" /> 任务待办 (Task)
            </label>
            <button
              onClick={() => {
                if (selectedNode.task) {
                  onUpdateNode(selectedNode.id, { task: undefined });
                } else {
                  onUpdateNode(selectedNode.id, { task: { status: 'todo', priority: defaultTaskPriority } });
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                selectedNode.task
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
              }`}
            >
              {selectedNode.task ? '开启中' : '设为任务'}
            </button>
          </div>

          {selectedNode.task && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-1">
                {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onUpdateNode(selectedNode.id, {
                        task: { ...selectedNode.task!, status: st }
                      });
                    }}
                    className={`py-1 text-center rounded text-[11px] font-medium border transition-colors ${
                      selectedNode.task?.status === st
                        ? st === 'done' ? 'bg-emerald-500 text-white border-emerald-500'
                          : st === 'doing' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {st === 'todo' ? '待办' : st === 'doing' ? '进行中' : '已完成'}
                  </button>
                ))}
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="task-priority" className="text-[11px] text-slate-400 block mb-1">优先级</label>
                <select id="task-priority" value={selectedNode.task.priority || ''}
                  onChange={event => onUpdateNode(selectedNode.id, { task: { ...selectedNode.task!, priority: event.target.value ? Number(event.target.value) as 1 | 2 | 3 : undefined } })}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[11px]">
                  <option value="">未指定</option><option value="1">高</option><option value="2">中</option><option value="3">低</option>
                </select>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">截止日期:</span>
                <input
                  type="date"
                  value={selectedNode.task.dueDate || ''}
                  onChange={(e) => {
                    onUpdateNode(selectedNode.id, {
                      task: { ...selectedNode.task!, dueDate: e.target.value || undefined }
                    });
                  }}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[11px] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Hyperlink */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-1.5">
            <Link className="w-3.5 h-3.5" /> 超链接网址
          </label>
          <input
            type="url"
            value={linkText}
            placeholder="https://example.com"
            onChange={(e) => setLinkText(e.target.value)}
            onBlur={handleLinkBlur}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs"
          />
          {linkError && <p role="alert" className="mt-1 text-[11px] text-red-600">{linkError}</p>}
        </div>

        {/* Zotero Item Link Action Box */}
        {(() => {
          const zoteroTargetKey =
            currentDoc.metadata?.zoteroItemKey ||
            (selectedNode.link && selectedNode.link.startsWith('zotero://') ? selectedNode.link : null);

          if (!zoteroTargetKey) return null;

          const handleManualSync = async () => {
            setIsSyncingToZotero(true);
            setSyncStatusMsg(null);
            try {
              const res = await saveMindMapToZoteroAttachment(currentDoc, zoteroTargetKey, { silent: true });
              if (res.success) {
                setSyncStatusMsg(res.message || '已同步至文献附件');
              } else {
                setSyncStatusMsg(res.message || '未关联到对应条目');
              }
            } catch (err: any) {
              setSyncStatusMsg('同步出错: ' + (err?.message || err));
            } finally {
              setIsSyncingToZotero(false);
              setTimeout(() => setSyncStatusMsg(null), 3500);
            }
          };

          const docZoteroTitle = currentDoc.metadata?.zoteroItemTitle;

          return (
            <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-xs text-sky-700 dark:text-sky-300">
                  <GraduationCap className="w-4 h-4 text-sky-600" />
                  <span>Zotero 文献伴读与归档</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-medium">
                  双向联动
                </span>
              </div>

              {docZoteroTitle && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 bg-white/70 dark:bg-slate-800/70 p-1.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">关联条目：</span>
                  {docZoteroTitle}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => locateItemInZotero(zoteroTargetKey)}
                  className="flex-1 py-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>文库定位</span>
                </button>
                <button
                  type="button"
                  onClick={() => openItemPdfInZotero(zoteroTargetKey)}
                  className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>阅读 PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingToZotero}
                className="w-full py-1.5 px-2 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200 border border-sky-300/60 dark:border-sky-800 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSyncingToZotero ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在同步归档...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>立即同步至条目附件与笔记</span>
                  </>
                )}
              </button>

              {syncStatusMsg && (
                <div className="text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{syncStatusMsg}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Link to another document or a specific topic */}
        <div className="space-y-2 p-2.5 rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20">
          <label className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
            <Link2 className="w-3.5 h-3.5" /> 关联导图主题
          </label>
          <select
            value={selectedNode.internalLink?.documentId || ''}
            onChange={(event) => {
              setTargetSearch('');
              onUpdateNode(selectedNode.id, { internalLink: event.target.value ? { documentId: event.target.value } : undefined });
            }}
            aria-label="选择关联导图"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="">不关联</option>
            {selectedNode.internalLink && !documents.some(document => document.id === selectedNode.internalLink?.documentId) && currentDoc.id !== selectedNode.internalLink.documentId &&
              <option value={selectedNode.internalLink.documentId}>目标导图已删除</option>}
            {documents.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}
            {!documents.some(document => document.id === currentDoc.id) && <option value={currentDoc.id}>{currentDoc.title}</option>}
          </select>
          {selectedNode.internalLink && (
            <>
              <p className="text-[10px] text-slate-500">目标主题：{targetNodes.find(node => node.id === selectedNode.internalLink?.nodeId)?.text || (targetNodes.length ? '中心主题或主题已删除' : '目标导图不可用')}</p>
              <input
                value={targetSearch}
                onChange={event => setTargetSearch(event.target.value)}
                placeholder="搜索目标主题（留空为中心主题）"
                aria-label="搜索关联主题"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
              {targetSearch.trim() && (
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {targetNodes.filter(node => node.text.toLocaleLowerCase().includes(targetSearch.trim().toLocaleLowerCase())).slice(0, 20).map(node => (
                    <button key={node.id} type="button" onClick={() => {
                      onUpdateNode(selectedNode.id, { internalLink: { documentId: selectedNode.internalLink!.documentId, nodeId: node.id } });
                      setTargetSearch('');
                    }} className="block w-full text-left truncate px-2 py-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40" title={node.text}>
                      {'· '.repeat(Math.min(node.depth, 5))}{node.text}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => onUpdateNode(selectedNode.id, { internalLink: { documentId: selectedNode.internalLink!.documentId } })} className="text-[11px] text-violet-600">指向中心主题</button>
                <button type="button" onClick={() => onOpenInternalLink?.(selectedNode.internalLink!.documentId, selectedNode.internalLink!.nodeId)} className="text-[11px] font-medium text-violet-700 dark:text-violet-300">打开目标</button>
              </div>
            </>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="flex items-center gap-1.5 font-medium text-slate-500 mb-1.5">
            <Tag className="w-3.5 h-3.5" /> 标签
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedNode.tags?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px]"
              >
                {t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-blue-900"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newTagText}
              placeholder="新增标签名"
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs"
            />
            <button
              onClick={handleAddTag}
              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center justify-between gap-1.5 font-medium text-slate-500 mb-1.5">
            <FileText className="w-3.5 h-3.5" /> 备注注释
            <span className="ml-auto text-[10px] font-normal text-slate-400">{noteText.length} 字</span>
          </label>
          <textarea
            rows={noteRows}
            value={noteText}
            placeholder="为该主题添加长文本备注或待办细节..."
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
            className="w-full min-h-24 max-h-[55vh] overflow-y-auto px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-blue-400 text-xs resize-y"
          />
        </div>
      </div>
    </aside>
  );
};
