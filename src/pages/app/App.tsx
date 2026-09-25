import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MindMapDocument, MindMapNode, ViewportTransform, LayoutType, InboxItem, TaskStatus,
  RelationshipLink
} from '../../core/model/types';
import {
  addChildNode, addSiblingNode, updateNode, deleteNode,
  toggleNodeCollapse, moveNode, findNode, findAdjacentNode, generateId,
  duplicateNode, pasteSubtree, deleteMultipleNodes, updateMultipleNodes,
  setCollapseByLevel, replaceNodeText, replaceAllNodeText
} from '../../core/model/treeOps';
import { computeLayout } from '../../core/layout/layoutEngine';
import { prepareNodeImage } from '../../core/model/nodeImage';
import { getTheme } from '../../core/theme/themes';
import { TemplateDefinition } from '../../core/model/templates';
import { HistoryManager } from '../../core/history/historyManager';
import { DocumentConflictError, StorageService } from '../../services/storage/storageService';
import {
  exportToPNG, exportToSVG, exportToMarkdown, exportToJSON, importFromMarkdown,
  exportToOPML, importFromOPML, exportToInteractiveHTML, printToPDF
} from '../../services/io/exporter';
import {
  isZoteroEnvironment, getSelectedZoteroItems, convertZoteroItemToNode,
  saveMindMapToZoteroNote, saveMindMapToZoteroAttachment, getSampleAcademicItems, extractZoteroItemData,
  locateItemInZotero, openItemPdfInZotero, openZoteroPreferences, getZoteroInstance, ZoteroItemData
} from '../../services/zotero/zoteroBridge';
import { playAddNode, playTaskComplete, playDeleteNode } from '../../services/audio/soundService';
import { Canvas } from '../../components/canvas/Canvas';
import { CanvasErrorBoundary } from '../../components/canvas/CanvasErrorBoundary';
import { Toolbar } from '../../components/toolbar/Toolbar';
import { PropertySidebar } from '../../components/sidebar/PropertySidebar';
import { LeftWorkbench, WorkbenchTab } from '../../components/sidebar/LeftWorkbench';
import { ShortcutsModal } from '../../components/modal/ShortcutsModal';
import { TemplateModal } from '../../components/modal/TemplateModal';
import { CommandPalette } from '../../components/command/CommandPalette';
import { Minimap } from '../../components/minimap/Minimap';
import { SettingsModal } from '../../components/modal/SettingsModal';
import { CanvasSearch } from '../../components/search/CanvasSearch';
import { ContextMenu } from '../../components/menu/ContextMenu';
import { PresentationMode } from '../../components/presentation/PresentationMode';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/model/settingsTypes';
import { createBlankDocument } from '../../core/model/sampleData';
import { WelcomeModal } from '../../components/modal/WelcomeModal';
import { SettingsService } from '../../services/storage/settingsService';
import { BackupService, MAX_BACKUP_BYTES, validateMindMapDocument } from '../../services/storage/backupService';
import { WebDAVService } from '../../services/sync/webdavService';
import { safeStorage } from '../../services/storage/safeStorage';
import { Minimize2 } from 'lucide-react';

interface AppProps {
  isSidepanelMode?: boolean;
}

export const App: React.FC<AppProps> = ({ isSidepanelMode = false }) => {
  const [doc, setDoc] = useState<MindMapDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isZoteroMode] = useState<boolean>(() => isZoteroEnvironment());
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
  const clipboardSubtreeRef = useRef<MindMapNode | null>(null);
  const clipboardNodeTokenRef = useRef<string | null>(null);
  const clipboardNodeTextRef = useRef<string | null>(null);
  const imageImportBusyRef = useRef(false);

  // Workbench & Sidebar Layout (Ergonomic left-right docking)
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('docs');
  const [dockPosition, setDockPosition] = useState<'left' | 'right'>(() => {
    return (safeStorage.getItem('mindflow_dock_pos') as 'left' | 'right') || 'left';
  });

  const [isPropertySidebarOpen, setIsPropertySidebarOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // New features: In-canvas Search, Presentation Mode, Node Context Menu, Commercial License
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMatchedIds, setSearchMatchedIds] = useState<string[]>([]);
  const [focusedTag, setFocusedTag] = useState<string | null>(null);
  useEffect(() => { setFocusedTag(null); }, [doc?.id]);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; node: MindMapNode } | null>(null);
  const [relationships, setRelationships] = useState<RelationshipLink[]>([]);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<{
    state: 'saving' | 'saved' | 'warning' | 'error';
    message: string;
  }>({ state: 'saved', message: '已保存到本地' });
  const cleanDocRef = useRef<MindMapDocument | null>(null);
  const cleanRelationshipsRef = useRef<RelationshipLink[]>([]);
  const latestDocRef = useRef<MindMapDocument | null>(null);
  const latestRelationshipsRef = useRef<RelationshipLink[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const zoteroSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaveTokenRef = useRef(0);
  const autoSyncTimerRef = useRef<number | undefined>(undefined);
  const saveGenerationRef = useRef(0);
  const pendingNavigationRef = useRef<{ documentId: string; nodeId?: string } | null>(null);
  const currentDocIdRef = useRef<string | null>(null);
  currentDocIdRef.current = doc?.id || null;
  latestDocRef.current = doc;
  latestRelationshipsRef.current = relationships;
  useEffect(() => () => window.clearTimeout(autoSyncTimerRef.current), []);

  // Synchronize document title with host Zotero Tab header
  useEffect(() => {
    if (doc?.title && typeof window !== 'undefined' && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'MINDFLOW_SET_TAB_TITLE',
          title: `${doc.title} - MindFlow`,
        }, '*');
      } catch {
        // ignore
      }
    }
  }, [doc?.title]);

  // Load Settings on mount & handle Welcome display
  useEffect(() => {
    SettingsService.getSettings().then((loaded) => {
      setSettings(loaded);
      setDockPosition(loaded.workbenchDockPosition);

      // Check if opened directly with context-action arguments
      let hasDirectAction = false;
      if (typeof window !== 'undefined' && window.arguments && window.arguments[0]) {
        const args = window.arguments[0];
        if (args.mode === 'create_from_selection' || args.mode === 'create_from_collection') {
          hasDirectAction = true;
        }
      }
      if (loaded.showWelcomeOnStartup && !hasDirectAction) {
        setIsWelcomeOpen(true);
      }
    });
  }, []);

  // Zotero's native settings pane can stay open beside an existing map tab.
  // Follow its canonical preference rather than keeping the mount-time copy.
  useEffect(() => {
    if (!isZoteroMode) return;
    const zotero = getZoteroInstance();
    const refresh = () => {
      void SettingsService.getSettings().then((loaded) => {
        setSettings(loaded);
        setDockPosition(loaded.workbenchDockPosition);
      }).catch((error) => console.warn('[MindFlow] Could not refresh settings:', error));
    };
    const observer = zotero?.Prefs?.registerObserver?.('mindflow.mindflow_app_settings', refresh, true);
    window.addEventListener('focus', refresh);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (observer) zotero?.Prefs?.unregisterObserver?.(observer);
    };
  }, [isZoteroMode]);

  // History Manager
  const historyRef = useRef<HistoryManager>(new HistoryManager(50));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 800 });

  // Update history states
  const syncHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const handleToggleDockPosition = () => {
    const next = dockPosition === 'left' ? 'right' : 'left';
    setDockPosition(next);
    SettingsService.updateSettings({ workbenchDockPosition: next }).then(setSettings);
  };

  // Center canvas on root or specific node
  const centerCanvas = useCallback((bounds?: { minX: number; maxX: number; minY: number; maxY: number }) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth || 1000;
    const ch = containerRef.current.clientHeight || 800;
    setContainerSize({ width: cw, height: ch });

    if (bounds) {
      const bw = bounds.maxX - bounds.minX;
      const bh = bounds.maxY - bounds.minY;
      const scaleW = (cw - 120) / Math.max(bw, 200);
      const scaleH = (ch - 120) / Math.max(bh, 200);
      const fitScale = Math.min(Math.max(Math.min(scaleW, scaleH), 0.5), 1.15);

      const midX = (bounds.minX + bounds.maxX) / 2;
      const midY = (bounds.minY + bounds.maxY) / 2;

      setViewport({
        x: cw / 2 - midX * fitScale,
        y: ch / 2 - midY * fitScale,
        scale: fitScale,
      });
    } else {
      setViewport({
        x: cw / 2,
        y: ch / 2,
        scale: 1,
      });
    }
  }, []);

  // Document changes cancel the debounced save. Flush the latest editor state
  // first so switching maps cannot silently discard recent typing.
  const flushCurrentDocument = useCallback(async (): Promise<boolean> => {
    try {
      pendingSaveTokenRef.current += 1;
      await saveQueueRef.current;
      const latest = latestDocRef.current;
      const latestRelationships = latestRelationshipsRef.current;
      if (!latest || (cleanDocRef.current === latest && cleanRelationshipsRef.current === latestRelationships)) return true;
      try {
        await StorageService.saveDocument({ ...latest, relationships: latestRelationships });
        cleanDocRef.current = latest;
        cleanRelationshipsRef.current = latestRelationships;
        if (latestDocRef.current !== latest || latestRelationshipsRef.current !== latestRelationships) {
          setSaveStatus({ state: 'warning', message: '保存期间又有新编辑；请暂停编辑后重试切换。' });
          return false;
        }
        return true;
      } catch (error) {
        if (!(error instanceof DocumentConflictError)) throw error;
        const copy = await StorageService.saveDocument({
          ...latest,
          relationships: latestRelationships,
          id: 'doc_' + generateId(),
          title: `${latest.title}（冲突副本）`,
          revision: 0,
          createdAt: Date.now(),
        });
        setSaveStatus({ state: 'warning', message: `原导图发生版本冲突；编辑已保存在「${copy.title}」。` });
        return latestDocRef.current === latest && latestRelationshipsRef.current === latestRelationships;
      }
    } catch (error: any) {
      setSaveStatus({ state: 'error', message: `切换已停止：当前导图保存失败：${error?.message || '存储不可用'}` });
      return false;
    }
  }, []);

  // Reload current workspace (e.g. after full backup restore)
  const reloadWorkspace = useCallback(async () => {
    const loadedDoc = await StorageService.getActiveDocument();
      const loadedRelationships = loadedDoc.relationships || [];
      setDoc(loadedDoc);
      setRelationships(loadedRelationships);
      cleanDocRef.current = loadedDoc;
      cleanRelationshipsRef.current = loadedRelationships;
      setSelectedId(loadedDoc.root.id);
      historyRef.current.clear();
      syncHistoryState();
      setTimeout(() => centerCanvas(), 50);
  }, [centerCanvas, syncHistoryState]);

  const openIncomingZoteroDocument = useCallback(async (rawDoc: unknown) => {
    if (!(await flushCurrentDocument())) return;
    const incoming = validateMindMapDocument(rawDoc, '打开文献导图');
    const local = await StorageService.getDocument(incoming.id, { trackRevision: false });
    let documentToOpen = incoming;
    if (local && local.updatedAt >= incoming.updatedAt) {
      documentToOpen = local;
      setSaveStatus({ state: 'warning', message: '本地导图版本较新，已保留本地编辑；Zotero 附件没有覆盖它。' });
    } else {
      if (local) {
        await StorageService.saveDocument({
          ...local,
          id: 'doc_' + generateId(),
          title: `${local.title}（附件导入前副本）`,
          revision: 0,
          createdAt: Date.now(),
          metadata: { ...local.metadata, autoSyncToZotero: false, zoteroItemKey: undefined },
        });
      }
      documentToOpen = await StorageService.saveDocument(incoming, { force: true });
      if (local) setSaveStatus({ state: 'warning', message: '已打开较新的 Zotero 附件，原本地导图已保存为独立副本。' });
    }
    await StorageService.setActiveDocumentId(documentToOpen.id);
    cleanDocRef.current = documentToOpen;
    cleanRelationshipsRef.current = documentToOpen.relationships || [];
    setRelationships(cleanRelationshipsRef.current);
    setDoc(documentToOpen);
    setSelectedId(documentToOpen.root.id);
    setSelectedIds([]);
    historyRef.current.clear();
    syncHistoryState();
    setIsWelcomeOpen(false);
    setTimeout(() => centerCanvas(), 60);
  }, [centerCanvas, flushCurrentDocument, syncHistoryState]);

  /**
   * Create a brand-new dedicated mind map document from Zotero literature item(s),
   * set the root node and document title to the paper, and immediately archive
   * into Zotero as a child attachment (.mindflow) and outline note.
   */
  const createMindMapFromZoteroItems = useCallback(
    async (rawItems: any[] | ZoteroItemData[]) => {
      if (!Array.isArray(rawItems) || rawItems.length === 0) return;
      const parsedItems: ZoteroItemData[] = [];
      for (const raw of rawItems) {
        const d = extractZoteroItemData(raw);
        if (d) parsedItems.push(d);
      }
      if (parsedItems.length === 0) return;

      if (!(await flushCurrentDocument())) return;

      let newDoc: MindMapDocument;
      const primaryItem = parsedItems[0];
      const primaryItemKey = primaryItem.zoteroUri;

      if (parsedItems.length === 1) {
        const item = parsedItems[0];
        const itemNode = convertZoteroItemToNode(item);
        const rootNode: MindMapNode = {
          id: generateId(),
          text: item.title || '文献导图',
          note: settings.zoteroIncludeAbstract && item.abstract ? `【文献摘要】\n${item.abstract}` : undefined,
          link: item.zoteroUri,
          tags: settings.zoteroIncludeTags && item.tags?.length ? item.tags : undefined,
          color: '#0284c7',
          isExpanded: true,
          children: itemNode.children,
        };

        newDoc = {
          id: 'doc_' + generateId(),
          title: item.title || '文献导图',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          root: rootNode,
          themeId: settings.defaultThemeId,
          layoutType: settings.defaultLayout,
          metadata: {
            zoteroItemKey: item.zoteroUri,
            zoteroLibraryID: item.libraryID,
            zoteroItemTitle: item.title,
            zoteroUri: item.zoteroUri,
            zoteroYear: item.year,
            zoteroAuthors: item.authors,
            autoSyncToZotero: true,
          },
        };
      } else {
        const title = `Zotero 文献专题导图 (${parsedItems.length} 篇)`;
        const rootNode: MindMapNode = {
          id: generateId(),
          text: `📚 文献研读专题 (${parsedItems.length} 篇)`,
          color: '#0284c7',
          isExpanded: true,
          children: parsedItems.map((item) => convertZoteroItemToNode(item)),
        };

        newDoc = {
          id: 'doc_' + generateId(),
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          root: rootNode,
          themeId: settings.defaultThemeId,
          layoutType: settings.defaultLayout,
          metadata: {
            zoteroItemKey: primaryItemKey,
            zoteroItemKeys: parsedItems.map((i) => i.zoteroUri),
            zoteroLibraryID: primaryItem.libraryID,
            autoSyncToZotero: true,
          },
        };
      }

      const savedDoc = await StorageService.saveDocument(newDoc);
      await StorageService.setActiveDocumentId(savedDoc.id);
      cleanDocRef.current = savedDoc;
      cleanRelationshipsRef.current = [];
      setRelationships([]);
      setDoc(savedDoc);
      setSelectedId(savedDoc.root.id);
      setSelectedIds([]);
      historyRef.current.clear();
      syncHistoryState();
      setIsWelcomeOpen(false);
      setTimeout(() => centerCanvas(), 60);

      // Auto archive directly into Zotero literature item attachment (.mindflow) and child note!
      if (isZoteroMode) {
        setSaveStatus({ state: 'saving', message: '正在自动归档至 Zotero 文献条目…' });
        try {
          const res = await saveMindMapToZoteroAttachment(savedDoc, primaryItemKey, { silent: false });
          setSaveStatus({ state: res.success ? 'saved' : 'warning', message: res.message });
        } catch (e: any) {
          console.warn('[MindFlow] Auto-archive note:', e);
          setSaveStatus({ state: 'warning', message: '导图已创建，但归档至条目附件受阻：' + (e?.message || e) });
        }
      } else {
        setSaveStatus({ state: 'saved', message: '已在当前工作区创建学术文献导图' });
      }
    },
    [centerCanvas, flushCurrentDocument, isZoteroMode, settings, syncHistoryState]
  );

  /**
   * Import an entire Zotero collection as a structured knowledge map
   */
  const importZoteroCollection = useCallback(
    async (collectionName: string, items: any[]) => {
      const parsedItems: ZoteroItemData[] = [];
      for (const raw of items) {
        const d = extractZoteroItemData(raw);
        if (d) parsedItems.push(d);
      }

      if (!(await flushCurrentDocument())) return;

      const rootNode: MindMapNode = {
        id: generateId(),
        text: `📁 ${collectionName || '专题文献分类'}`,
        color: '#0284c7',
        isExpanded: true,
        children: parsedItems.map((item) => convertZoteroItemToNode(item)),
      };

      const newDoc: MindMapDocument = {
        id: 'doc_' + generateId(),
        title: `${collectionName || '文献分类'} 知识脉络导图`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        root: rootNode,
        themeId: settings.defaultThemeId,
        layoutType: settings.defaultLayout,
        metadata: {
          zoteroCollectionName: collectionName,
          zoteroItemKeys: parsedItems.map((i) => i.zoteroUri),
          zoteroItemKey: parsedItems[0]?.zoteroUri,
          zoteroLibraryID: parsedItems[0]?.libraryID,
          autoSyncToZotero: true,
        },
      };

      const saved = await StorageService.saveDocument(newDoc);
      await StorageService.setActiveDocumentId(saved.id);
      cleanDocRef.current = saved;
      cleanRelationshipsRef.current = [];
      setRelationships([]);
      setDoc(saved);
      setSelectedId(saved.root.id);
      setSelectedIds([]);
      historyRef.current.clear();
      syncHistoryState();
      setIsWelcomeOpen(false);
      setTimeout(() => centerCanvas(), 60);

      if (isZoteroMode && parsedItems.length > 0) {
        saveMindMapToZoteroAttachment(saved, parsedItems[0].zoteroUri, { silent: false }).then((res) => {
          setSaveStatus({ state: res.success ? 'saved' : 'warning', message: res.message });
        }).catch((error) => setSaveStatus({ state: 'warning', message: `导图已创建，附件归档失败：${error?.message || error}` }));
      }
    },
    [centerCanvas, flushCurrentDocument, isZoteroMode, settings, syncHistoryState]
  );

  // Load active document on mount
  useEffect(() => {
    let disposed = false;
    const workspaceReady = reloadWorkspace();

    // Check if opened directly with Zotero items or document via context menu or toolbar
    if (typeof window !== 'undefined' && window.arguments && window.arguments[0]) {
      const args = window.arguments[0];
      if (args.mode === 'open_document' && args.doc) {
        setTimeout(async () => {
          try {
            await workspaceReady;
            if (!disposed) await openIncomingZoteroDocument(args.doc);
          } catch (e) {
            console.error('[MindFlow] Failed to load initial document from args:', e);
          }
        }, 100);
      } else if (
        (args.mode === 'create_from_selection' || args.mode === 'create_from_items') &&
        Array.isArray(args.items) &&
        args.items.length > 0
      ) {
        setTimeout(() => void createMindMapFromZoteroItems(args.items), 120);
      } else if (args.mode === 'create_from_collection' && Array.isArray(args.items)) {
        setTimeout(() => void importZoteroCollection(args.collectionName || args.collection?.name || '文献分类', args.items), 120);
      }
    }

    // Listen for live imports and document loads when running inside a persistent Zotero tab or standalone window
    const handleImportMessage = (event: any) => {
      if (event.type === 'message' && window.parent !== window && event.source !== window.parent) return;
      const data = event.data || event.detail;
      if (!data) return;

      if (data.type === 'MINDFLOW_LOAD_DOCUMENT' && data.doc) {
        void openIncomingZoteroDocument(data.doc).catch((e) => {
          console.error('[MindFlow] Failed to load document from message:', e);
          setSaveStatus({ state: 'error', message: `打开 Zotero 附件失败：${e?.message || e}` });
        });
      } else if (
        data.type === 'MINDFLOW_CREATE_FROM_ITEMS' ||
        (data.mode === 'create_from_selection' && Array.isArray(data.items))
      ) {
        const items = data.items || [];
        void createMindMapFromZoteroItems(items);
      } else if (data.type === 'MINDFLOW_IMPORT_ZOTERO_ITEMS' || data.type === 'MINDFLOW_APPEND_ZOTERO_ITEMS') {
        const items = data.items || [];
        if (data.action === 'append' || data.type === 'MINDFLOW_APPEND_ZOTERO_ITEMS') {
          // Explicitly requested to append as branch to current map
          const current = latestDocRef.current;
          if (current) {
            const parentId = selectedId || current.root.id;
            let currentRoot = current.root;
            for (const rawItem of items) {
              const itemData = extractZoteroItemData(rawItem);
              if (itemData) {
                const itemNode = convertZoteroItemToNode(itemData);
                const { newRoot, newNodeId } = addChildNode(currentRoot, parentId, itemNode.text);
                currentRoot = updateNode(newRoot, newNodeId, {
                  note: itemNode.note,
                  link: itemNode.link,
                  tags: itemNode.tags,
                  color: itemNode.color,
                  children: itemNode.children,
                });
              }
            }
            commitRootChange(currentRoot);
          }
        } else {
          // Default: create a dedicated independent mind map document
          void createMindMapFromZoteroItems(items);
        }
      } else if (data.type === 'MINDFLOW_IMPORT_ZOTERO_COLLECTION' || data.mode === 'create_from_collection') {
        const items = data.items || [];
        void importZoteroCollection(data.collectionName || '文献分类', items);
      }
    };

    window.addEventListener('message', handleImportMessage);
    window.addEventListener('mindflow-import-items', handleImportMessage);
    if (isZoteroMode && window.parent !== window) {
      void workspaceReady.then(() => {
        if (!disposed) window.parent.postMessage({ type: 'MINDFLOW_READY' }, '*');
      }).catch((error) => setSaveStatus({ state: 'error', message: `加载工作区失败：${error?.message || error}` }));
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (msg: any) => {
        if (msg.type === 'DOC_UPDATED') {
          setSaveStatus({ state: 'warning', message: '其他窗口更新了导图；本窗口若有编辑，将另存为冲突副本。' });
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => {
        disposed = true;
        chrome.runtime.onMessage.removeListener(listener);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('message', handleImportMessage);
        window.removeEventListener('mindflow-import-items', handleImportMessage);
      };
    }

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('message', handleImportMessage);
      window.removeEventListener('mindflow-import-items', handleImportMessage);
    };
  }, [centerCanvas, createMindMapFromZoteroItems, importZoteroCollection, isZoteroMode, openIncomingZoteroDocument, reloadWorkspace]);

  // Auto-save locally, create interval-based recovery snapshots, then report
  // local/cloud outcomes separately so failures are visible to the user.
  useEffect(() => {
    if (!doc) return;
    if (cleanDocRef.current === doc && cleanRelationshipsRef.current === relationships) return;
    const saveToken = ++pendingSaveTokenRef.current;
    setSaveStatus({ state: 'saving', message: '保存中…' });
    const timeout = setTimeout(() => {
      if (saveToken !== pendingSaveTokenRef.current) return;
      const runSave = async () => {
      if (saveToken !== pendingSaveTokenRef.current) return;
      if (currentDocIdRef.current !== doc.id) return;
      const documentToSave = { ...doc, relationships };
      try {
        await StorageService.saveDocument(documentToSave);
      } catch (error: any) {
        if (error instanceof DocumentConflictError) {
          if (currentDocIdRef.current !== doc.id) return;
          try {
            const latestLocal = latestDocRef.current?.id === doc.id ? latestDocRef.current : documentToSave;
            const latestRelationships = latestRelationshipsRef.current;
            const copy = await StorageService.saveDocument({
              ...latestLocal,
              relationships: latestRelationships,
              id: 'doc_' + generateId(),
              title: `${latestLocal.title}（冲突副本）`,
              revision: 0,
              createdAt: Date.now(),
            });
            if (currentDocIdRef.current !== doc.id) return;
            cleanDocRef.current = copy;
            cleanRelationshipsRef.current = latestRelationships;
            await StorageService.setActiveDocumentId(copy.id);
            const afterCopy = latestDocRef.current;
            setDoc(afterCopy?.id === doc.id && afterCopy !== latestLocal
              ? { ...afterCopy, id: copy.id, title: copy.title, revision: copy.revision, createdAt: copy.createdAt }
              : copy);
            setSaveStatus({ state: 'warning', message: '其他窗口已修改原导图；本窗口内容已保存为冲突副本，请检查并合并。' });
          } catch (copyError: any) {
            setSaveStatus({ state: 'error', message: `原导图发生冲突，副本保存失败：${copyError?.message || '未知错误'}` });
          }
          return;
        }
        console.error('MindFlow local save failed', error);
        setSaveStatus({ state: 'error', message: `本地保存失败：${error?.message || '存储空间可能已满'}` });
        return;
      }
      if (currentDocIdRef.current === doc.id) {
        cleanDocRef.current = doc;
        cleanRelationshipsRef.current = relationships;
      }
      const saveGeneration = ++saveGenerationRef.current;

      let warning = '';
      if (settings.autoSnapshotEnabled) {
        try {
          await BackupService.createAutoSnapshotIfDue(documentToSave, settings.autoSnapshotIntervalMinutes);
        } catch (error: any) {
          console.error('MindFlow recovery snapshot failed', error);
          warning = '本地导图已保存，但自动版本快照失败。';
        }
      }

      // Silently sync updated mind map to the Zotero item attachment (.mindflow) and outline note
      if (isZoteroMode && documentToSave.metadata?.zoteroItemKey && documentToSave.metadata.autoSyncToZotero !== false) {
        const archiveTarget = documentToSave.metadata.zoteroItemKey;
        const archive = zoteroSyncQueueRef.current.catch(() => undefined).then(async () => {
          const result = await saveMindMapToZoteroAttachment(
            documentToSave,
            archiveTarget,
            { silent: true }
          );
          if (!result.success && saveGenerationRef.current === saveGeneration) {
            setSaveStatus({ state: 'warning', message: `本地导图已保存；Zotero 附件归档失败：${result.message}` });
          }
        }).catch((error) => {
          if (saveGenerationRef.current === saveGeneration) {
            setSaveStatus({ state: 'warning', message: `本地导图已保存；Zotero 附件归档失败：${error?.message || error}` });
          }
        });
        zoteroSyncQueueRef.current = archive;
      }

      setSaveStatus(warning
        ? { state: 'warning', message: warning }
        : {
          state: 'saved',
          message: settings.webdav.enabled && settings.webdav.autoSyncOnSave
            ? '已保存到本地；云端备份将在编辑暂停后运行'
            : '已保存到本地',
        });
      window.clearTimeout(autoSyncTimerRef.current);
      if (settings.webdav.enabled && settings.webdav.autoSyncOnSave) {
        autoSyncTimerRef.current = window.setTimeout(async () => {
          try {
            if (!(await WebDAVService.hasServerPermission(settings.webdav.serverUrl))) {
              throw new Error('请在设置中授权当前 WebDAV 服务器');
            }
            const backupData = await BackupService.getFullWorkspaceData();
            const result = await WebDAVService.uploadBackup(settings.webdav, backupData);
            if (saveGenerationRef.current !== saveGeneration) return;
            setSaveStatus(result.success
              ? { state: 'saved', message: '已保存到本地并完成 WebDAV 备份' }
              : { state: 'warning', message: `本地已保存；云端备份失败：${result.message}` });
          } catch (error: any) {
            if (saveGenerationRef.current === saveGeneration) {
              setSaveStatus({ state: 'warning', message: `本地已保存；云端备份失败：${error?.message || '网络错误'}` });
            }
          }
        }, 15000);
      }
      };
      saveQueueRef.current = saveQueueRef.current.then(runSave, runSave);
    }, 600);
    return () => clearTimeout(timeout);
  }, [doc, isZoteroMode, relationships, settings.webdav, settings.autoSnapshotEnabled, settings.autoSnapshotIntervalMinutes]);

  // Dynamic document and window / tab title synchronization
  useEffect(() => {
    if (doc?.title) {
      document.title = `${doc.title} - MindFlow 思维导图`;
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage(
            {
              type: 'MINDFLOW_SET_TAB_TITLE',
              title: `MindFlow - ${doc.title.length > 20 ? doc.title.slice(0, 20) + '...' : doc.title}`,
            },
            '*'
          );
        } catch (_) {}
      }
    }
  }, [doc?.title]);

  // Theme
  const theme = useMemo(() => {
    return getTheme(doc?.themeId);
  }, [doc?.themeId]);

  // Layout calculation
  const layout = useMemo(() => {
    if (!doc) return { nodes: [], connections: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    return computeLayout(doc.root, doc.layoutType, theme, {
      rainbowBranches: settings.rainbowBranches,
      curveStyle: settings.curveStyle,
    });
  }, [doc, theme, settings.rainbowBranches, settings.curveStyle]);

  // Commit changes to root and push history
  const commitRootChange = useCallback((newRoot: MindMapNode) => {
    if (!doc) return;
    historyRef.current.push(doc.root);
    syncHistoryState();
    setDoc(prev => prev ? { ...prev, root: newRoot, relationships, updatedAt: Date.now() } : null);
  }, [doc, relationships, syncHistoryState]);

  // Selection handlers
  const handleSelectNode = useCallback((id: string | null, isMulti = false) => {
    if (!id) {
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }
    if (isMulti) {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (selectedId) set.add(selectedId);
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
        return Array.from(set);
      });
      setSelectedId(id);
    } else {
      setSelectedId(id);
      setSelectedIds([]);
    }
    if (id && !isZenMode) {
      setIsPropertySidebarOpen(true);
    }
  }, [selectedId, isZenMode]);

  const handleSelectMultipleNodes = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length > 0) {
      setSelectedId(ids[ids.length - 1]);
      if (!isZenMode) {
        setIsPropertySidebarOpen(true);
      }
    } else {
      setSelectedId(null);
    }
  }, [isZenMode]);

  // Actions
  const handleAddChild = useCallback(() => {
    if (!doc) return;
    const targetId = selectedId || doc.root.id;
    let rootToUse = doc.root;
    if (settings.autoExpandOnAddChild) {
      rootToUse = updateNode(rootToUse, targetId, { isExpanded: true });
    }
    const { newRoot, newNodeId } = addChildNode(rootToUse, targetId, '分支主题');
    commitRootChange(newRoot);
    setSelectedId(newNodeId);
    setSelectedIds([]);
    setEditingId(newNodeId);
    playAddNode(settings.soundEffects);
  }, [doc, selectedId, settings.autoExpandOnAddChild, settings.soundEffects, commitRootChange]);

  const handleAddSibling = useCallback((insertBefore = false) => {
    if (!doc) return;
    const targetId = selectedId || doc.root.id;
    const { newRoot, newNodeId } = addSiblingNode(doc.root, targetId, '分支主题', insertBefore);
    commitRootChange(newRoot);
    setSelectedId(newNodeId);
    setSelectedIds([]);
    setEditingId(newNodeId);
    playAddNode(settings.soundEffects);
  }, [doc, selectedId, settings.soundEffects, commitRootChange]);

  const handleCopyNode = useCallback((idToCopy?: string, writeSystemClipboard = false) => {
    if (!doc) return;
    const targetId = idToCopy || selectedId;
    if (!targetId) return;
    const target = findNode(doc.root, targetId);
    if (target) {
      clipboardSubtreeRef.current = JSON.parse(JSON.stringify(target));
      clipboardNodeTokenRef.current = crypto.randomUUID();
      clipboardNodeTextRef.current = target.text;
      if (writeSystemClipboard) {
        void navigator.clipboard.writeText(target.text).catch(error => {
          console.warn('MindFlow clipboard write failed', error);
        });
      }
    }
  }, [doc, selectedId]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (!doc || !selectedId || !clipboardSubtreeRef.current || !clipboardNodeTokenRef.current || editingId) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/plain', clipboardNodeTextRef.current || '');
      event.clipboardData.setData('application/x-mindflow-node', clipboardNodeTokenRef.current);
      event.preventDefault();
    };
    window.addEventListener('copy', handleCopy);
    return () => window.removeEventListener('copy', handleCopy);
  }, [doc, selectedId, editingId]);

  const handlePasteNode = useCallback((targetParentId?: string) => {
    if (!doc || !clipboardSubtreeRef.current) return;
    const parentId = targetParentId || selectedId || doc.root.id;
    const { newRoot, newNodeId } = pasteSubtree(doc.root, parentId, clipboardSubtreeRef.current);
    commitRootChange(newRoot);
    setSelectedId(newNodeId);
    setSelectedIds([]);
    playAddNode(settings.soundEffects);
  }, [doc, selectedId, commitRootChange, settings.soundEffects]);

  const handleDuplicateNode = useCallback((idToDuplicate?: string) => {
    if (!doc) return;
    const targetId = idToDuplicate || selectedId;
    if (!targetId || targetId === doc.root.id) return;
    const { newRoot, newNodeId } = duplicateNode(doc.root, targetId);
    commitRootChange(newRoot);
    setSelectedId(newNodeId);
    setSelectedIds([]);
    playAddNode(settings.soundEffects);
  }, [doc, selectedId, commitRootChange, settings.soundEffects]);

  const handleDeleteNode = useCallback((idToDelete?: string) => {
    if (!doc) return;
    if (idToDelete) {
      if (idToDelete === doc.root.id) return;
      const { newRoot, nextSelectedId } = deleteNode(doc.root, idToDelete);
      commitRootChange(newRoot);
      setSelectedId(nextSelectedId);
      setSelectedIds([]);
      playDeleteNode(settings.soundEffects);
      return;
    }

    const ids = selectedIds.length > 0
      ? selectedIds.filter((id) => id !== doc.root.id)
      : (selectedId && selectedId !== doc.root.id ? [selectedId] : []);

    if (ids.length === 0) return;

    if (ids.length === 1) {
      const { newRoot, nextSelectedId } = deleteNode(doc.root, ids[0]);
      commitRootChange(newRoot);
      setSelectedId(nextSelectedId);
      setSelectedIds([]);
    } else {
      const { newRoot } = deleteMultipleNodes(doc.root, ids);
      commitRootChange(newRoot);
      setSelectedId(doc.root.id);
      setSelectedIds([]);
    }
    playDeleteNode(settings.soundEffects);
  }, [doc, selectedId, selectedIds, commitRootChange, settings.soundEffects]);

  const handleToggleCollapse = useCallback((id: string) => {
    if (!doc) return;
    const newRoot = toggleNodeCollapse(doc.root, id);
    commitRootChange(newRoot);
  }, [doc, commitRootChange]);

  const handleMoveNode = useCallback((sourceId: string, targetId: string) => {
    if (!doc) return;
    const newRoot = moveNode(doc.root, sourceId, targetId);
    commitRootChange(newRoot);
  }, [doc, commitRootChange]);

  const handleUpdateNodePatch = useCallback((id: string, patch: Partial<MindMapNode>) => {
    if (!doc) return;
    const newRoot = updateNode(doc.root, id, patch);
    commitRootChange(newRoot);
  }, [doc, commitRootChange]);

  const handleImportNodeImage = useCallback(async (file: File, targetId?: string, createChild = false): Promise<void> => {
    if (imageImportBusyRef.current) throw new Error('另一张图片正在处理中，请稍后再试');
    imageImportBusyRef.current = true;
    try {
      const sourceDocId = doc?.id;
      if (!sourceDocId) throw new Error('请先打开导图');
      const image = await prepareNodeImage(file);
      const quota = await BackupService.getStorageQuota();
      const latest = latestDocRef.current;
      if (!latest || latest.id !== sourceDocId) throw new Error('导图已切换，请重新选择图片');
      const parentId = targetId || selectedId || latest.root.id;
      const target = findNode(latest.root, parentId);
      if (!target) throw new Error('目标节点已删除，请重新选择');
      const previousBytes = createChild ? 0 : (target.image?.dataUrl.length || 0);
      if (quota.usedBytes + image.dataUrl.length - previousBytes + 100_000 > quota.maxBytes) {
        throw new Error('本地存储空间不足。请先导出完整备份并清理旧快照，或选择更小的图片');
      }
      let newRoot: MindMapNode;
      let nextSelectedId = parentId;
      if (createChild) {
        const added = addChildNode(latest.root, parentId, '');
        nextSelectedId = added.newNodeId;
        newRoot = updateNode(added.newRoot, nextSelectedId, { type: 'image', image });
      } else {
        newRoot = updateNode(latest.root, parentId, { image });
      }
      historyRef.current.push(latest.root);
      syncHistoryState();
      setDoc({ ...latest, root: newRoot, updatedAt: Date.now() });
      setSelectedId(nextSelectedId);
      setSelectedIds([]);
      setIsPropertySidebarOpen(true);
    } finally {
      imageImportBusyRef.current = false;
    }
  }, [doc?.id, selectedId, syncHistoryState]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!doc || editingId || isSettingsOpen || isShortcutsOpen || isCommandPaletteOpen || isTemplateModalOpen || isSearchOpen || isPresentationOpen) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;

      const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const copiedToken = event.clipboardData?.getData('application/x-mindflow-node');
      const copiedText = event.clipboardData?.getData('text/plain');
      const isInternalNode = !!clipboardSubtreeRef.current && (
        (!!copiedToken && copiedToken === clipboardNodeTokenRef.current) ||
        (!copiedToken && !imageItem && copiedText !== undefined && copiedText === clipboardNodeTextRef.current)
      );
      if (isInternalNode) {
        event.preventDefault();
        handlePasteNode();
      } else if (imageItem) {
        const file = imageItem.getAsFile();
        if (!file) return;
        event.preventDefault();
        const targetId = selectedId || doc.root.id;
        void handleImportNodeImage(file, targetId).catch(error => {
          window.alert(`图片粘贴失败：${error?.message || '未知错误'}`);
        });
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [doc, editingId, selectedId, isSettingsOpen, isShortcutsOpen, isCommandPaletteOpen, isTemplateModalOpen, isSearchOpen, isPresentationOpen, handleImportNodeImage, handlePasteNode]);

  // Toggle Task Status (todo -> doing -> done -> todo)
  const handleToggleTaskStatus = useCallback((id: string) => {
    if (!doc) return;
    const target = findNode(doc.root, id);
    if (!target) return;

    let nextStatus: TaskStatus = 'todo';
    if (!target.task || target.task.status === 'todo') {
      nextStatus = 'doing';
    } else if (target.task.status === 'doing') {
      nextStatus = 'done';
    } else {
      nextStatus = 'todo';
    }

    if (nextStatus === 'done') {
      playTaskComplete(settings.soundEffects);
    }

    handleUpdateNodePatch(id, {
      task: {
        ...(target.task || {}),
        priority: target.task?.priority ?? settings.defaultTaskPriority,
        status: nextStatus,
        progress: nextStatus === 'done' ? 100 : nextStatus === 'doing' ? 50 : 0,
      },
    });
  }, [doc, handleUpdateNodePatch, settings.defaultTaskPriority, settings.soundEffects]);

  const handleCommitEdit = useCallback((id: string, newText: string) => {
    setEditingId(null);
    if (!doc) return;
    const target = findNode(doc.root, id);
    if (target && target.text !== newText && newText.trim()) {
      handleUpdateNodePatch(id, { text: newText.trim() });
    }
  }, [doc, handleUpdateNodePatch]);

  const handleUndo = useCallback(() => {
    if (!doc) return;
    const prev = historyRef.current.undo(doc.root);
    if (prev) {
      setDoc(prevDoc => prevDoc ? { ...prevDoc, root: prev } : null);
      syncHistoryState();
    }
  }, [doc, syncHistoryState]);

  const handleRedo = useCallback(() => {
    if (!doc) return;
    const next = historyRef.current.redo(doc.root);
    if (next) {
      setDoc(prevDoc => prevDoc ? { ...prevDoc, root: next } : null);
      syncHistoryState();
    }
  }, [doc, syncHistoryState]);

  // Select node and smoothly center canvas on it
  const handleSelectAndCenterNode = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    const target = layout.nodes.find(n => n.id === nodeId);
    if (target && containerRef.current) {
      const cw = containerRef.current.clientWidth || 1000;
      const ch = containerRef.current.clientHeight || 800;
      setViewport(v => ({
        ...v,
        x: cw / 2 - (target.x + target.width / 2) * v.scale,
        y: ch / 2 - (target.y + target.height / 2) * v.scale,
      }));
    }
  }, [layout.nodes]);

  const openDocumentAt = useCallback(async (documentId: string, nodeId?: string) => {
    if (doc?.id === documentId) {
      if (nodeId && findNode(doc.root, nodeId)) handleSelectAndCenterNode(nodeId);
      else handleSelectAndCenterNode(doc.root.id);
      return;
    }
    if (!(await flushCurrentDocument())) return;
    try {
      const selectedDoc = await StorageService.getDocument(documentId);
      if (!selectedDoc) {
        setSaveStatus({ state: 'warning', message: '链接目标导图已不存在，当前导图保持打开。' });
        return;
      }
      if (!(await flushCurrentDocument())) return;
      await StorageService.setActiveDocumentId(documentId);
      const loadedRelationships = selectedDoc.relationships || [];
      cleanDocRef.current = selectedDoc;
      cleanRelationshipsRef.current = loadedRelationships;
      pendingNavigationRef.current = { documentId, nodeId };
      setRelationships(loadedRelationships);
      setDoc(selectedDoc);
      setSelectedIds([]);
      setSelectedId(selectedDoc.root.id);
      historyRef.current.clear();
      syncHistoryState();
    } catch (error: any) {
      setSaveStatus({ state: 'error', message: `打开导图失败：${error?.message || '读取本地数据失败'}` });
    }
  }, [doc, flushCurrentDocument, handleSelectAndCenterNode, syncHistoryState]);

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!doc || pending?.documentId !== doc.id) return;
    const target = layout.nodes.find(node => node.id === pending.nodeId)
      || layout.nodes.find(node => node.id === doc.root.id);
    pendingNavigationRef.current = null;
    if (!target) return;
    setSelectedId(target.id);
    centerCanvas({ minX: target.x, maxX: target.x + target.width, minY: target.y, maxY: target.y + target.height });
    if (pending.nodeId && target.id !== pending.nodeId) {
      setSaveStatus({ state: 'warning', message: '目标主题已不存在，已打开目标导图的中心主题。' });
    }
  }, [doc, layout, centerCanvas]);

  // Handle node right click
  const handleContextMenuNode = useCallback((nodeId: string, clientX: number, clientY: number) => {
    if (!doc) return;
    const target = findNode(doc.root, nodeId);
    if (target) {
      setSelectedId(nodeId);
      setContextMenuState({ x: clientX, y: clientY, node: target });
    }
  }, [doc]);

  // Relationships Handlers
  const handleCreateRelationship = useCallback((fromId: string, toId: string) => {
    if (fromId === toId || !doc) return;
    const exists = relationships.some(
      (r) => (r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId)
    );
    if (exists) return;

    const newRel: RelationshipLink = {
      id: generateId(),
      fromId,
      toId,
      label: '关联',
      style: 'dashed',
      color: '#8b5cf6',
    };
    const nextRels = [...relationships, newRel];
    setRelationships(nextRels);
    const updated = { ...doc, relationships: nextRels, updatedAt: Date.now() };
    setDoc(updated);
  }, [doc, relationships]);

  const handleDeleteRelationship = useCallback((id: string) => {
    if (!doc) return;
    const nextRels = relationships.filter((r) => r.id !== id);
    setRelationships(nextRels);
    const updated = { ...doc, relationships: nextRels, updatedAt: Date.now() };
    setDoc(updated);
  }, [doc, relationships]);

  const handleEditRelationshipLabel = useCallback((id: string, label: string) => {
    if (!doc) return;
    const nextRels = relationships.map((r) => (r.id === id ? { ...r, label } : r));
    setRelationships(nextRels);
    const updated = { ...doc, relationships: nextRels, updatedAt: Date.now() };
    setDoc(updated);
  }, [doc, relationships]);

  // Search & Replace Handlers
  const handleReplaceNodeText = useCallback((nodeId: string, fromText: string, toText: string) => {
    if (!doc) return;
    const newRoot = replaceNodeText(doc.root, nodeId, fromText, toText);
    commitRootChange(newRoot);
  }, [doc, commitRootChange]);

  const handleReplaceAllNodeText = useCallback((fromText: string, toText: string) => {
    if (!doc) return;
    const { newRoot, count } = replaceAllNodeText(doc.root, fromText, toText);
    if (count > 0) {
      commitRootChange(newRoot);
    }
  }, [doc, commitRootChange]);

  // Level Collapse / Expand Handler
  const handleCollapseByLevel = useCallback((level: number) => {
    if (!doc) return;
    const newRoot = setCollapseByLevel(doc.root, level);
    commitRootChange(newRoot);
  }, [doc, commitRootChange]);

  // Batch Selection Handlers
  const handleBatchColor = useCallback((color: string) => {
    if (!doc || selectedIds.length === 0) return;
    const newRoot = updateMultipleNodes(doc.root, selectedIds, { color });
    commitRootChange(newRoot);
  }, [doc, selectedIds, commitRootChange]);

  const handleBatchTaskStatus = useCallback((status: TaskStatus) => {
    if (!doc || selectedIds.length === 0) return;
    const newRoot = updateMultipleNodes(doc.root, selectedIds, { task: { status } });
    commitRootChange(newRoot);
    if (status === 'done') playTaskComplete(settings.soundEffects);
  }, [doc, selectedIds, commitRootChange, settings.soundEffects]);

  const handleBatchDelete = useCallback(() => {
    if (!doc || selectedIds.length === 0) return;
    const { newRoot, nextSelectedId } = deleteMultipleNodes(doc.root, selectedIds);
    commitRootChange(newRoot);
    setSelectedIds([]);
    setSelectedId(nextSelectedId);
    playDeleteNode(settings.soundEffects);
  }, [doc, selectedIds, commitRootChange, settings.soundEffects]);

  // Insert Inbox item to mind map
  const handleInsertInboxItem = useCallback((item: InboxItem) => {
    if (!doc) return;
    const parentId = selectedId || doc.root.id;
    const { newRoot, newNodeId } = addChildNode(doc.root, parentId, item.text);
    const finalRoot = updateNode(newRoot, newNodeId, {
      link: item.url,
      note: item.title && item.title !== item.text ? item.title : undefined,
    });
    commitRootChange(finalRoot);
    handleSelectAndCenterNode(newNodeId);
  }, [doc, selectedId, commitRootChange, handleSelectAndCenterNode]);

  // Apply template
  const handleSelectTemplate = useCallback(async (tpl: TemplateDefinition) => {
    if (!(await flushCurrentDocument())) return;
    const newDoc: MindMapDocument = {
      id: 'doc_' + generateId(),
      title: tpl.title,
      themeId: tpl.themeId,
      layoutType: tpl.layoutType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      root: tpl.createRoot(),
    };
    const savedDoc = await StorageService.saveDocument(newDoc);
    await StorageService.setActiveDocumentId(savedDoc.id);
    cleanDocRef.current = savedDoc;
    cleanRelationshipsRef.current = [];
    setRelationships(cleanRelationshipsRef.current);
    setDoc(savedDoc);
    setSelectedId(newDoc.root.id);
    historyRef.current.clear();
    syncHistoryState();
    setTimeout(() => centerCanvas(), 50);
  }, [centerCanvas, flushCurrentDocument, syncHistoryState]);

  // Create clean blank document
  const handleCreateBlankDoc = useCallback(async () => {
    if (!(await flushCurrentDocument())) return;

    // Check if user currently has an item selected in Zotero
    let targetItemKey: string | undefined = undefined;
    let targetItemTitle: string | undefined = undefined;
    let targetItemUri: string | undefined = undefined;

    if (isZoteroMode) {
      const selected = getSelectedZoteroItems();
      if (selected && selected.length === 1) {
        targetItemKey = selected[0].zoteroUri;
        targetItemTitle = selected[0].title;
        targetItemUri = selected[0].zoteroUri;
      }
    }

    const docTitle = targetItemTitle ? `${targetItemTitle} - 思维导图` : '新建思维导图';
    const blankDoc = createBlankDocument(docTitle);
    blankDoc.themeId = settings.defaultThemeId;
    blankDoc.layoutType = settings.defaultLayout;

    if (targetItemKey) {
      blankDoc.metadata = {
        zoteroItemKey: targetItemKey,
        zoteroItemTitle: targetItemTitle,
        zoteroUri: targetItemUri,
        autoSyncToZotero: true,
      };
      if (targetItemUri) {
        blankDoc.root.link = targetItemUri;
      }
    }

    const savedDoc = await StorageService.saveDocument(blankDoc);
    await StorageService.setActiveDocumentId(savedDoc.id);
    cleanDocRef.current = savedDoc;
    cleanRelationshipsRef.current = [];
    setRelationships([]);
    setDoc(savedDoc);
    setSelectedId(savedDoc.root.id);
    setSelectedIds([]);
    historyRef.current.clear();
    syncHistoryState();
    setIsWelcomeOpen(false);
    setTimeout(() => {
      centerCanvas();
    }, 50);

    // If an item was selected, auto archive to that item right away
    if (isZoteroMode && targetItemKey) {
      saveMindMapToZoteroAttachment(savedDoc, targetItemKey, { silent: false }).then((res) => {
        setSaveStatus({ state: res.success ? 'saved' : 'warning', message: res.message });
      }).catch((error) => setSaveStatus({ state: 'warning', message: `导图已创建，附件归档失败：${error?.message || error}` }));
    }
  }, [centerCanvas, flushCurrentDocument, isZoteroMode, settings.defaultThemeId, settings.defaultLayout, syncHistoryState]);

  // Open settings handler: directly opens Zotero Preferences in Zotero environment
  const handleOpenSettings = useCallback(() => {
    if (isZoteroMode) {
      const opened = openZoteroPreferences();
      if (!opened) {
        setIsSettingsOpen(true);
      }
    } else {
      setIsSettingsOpen(true);
    }
  }, [isZoteroMode]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes floating search or context menu
      if (e.key === 'Escape') {
        if (contextMenuState) {
          setContextMenuState(null);
          return;
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
        if (isPresentationOpen) {
          setIsPresentationOpen(false);
          return;
        }
        if (isZenMode) {
          setIsZenMode(false);
          return;
        }
      }

      // Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // If editing text in input or textarea, skip global shortcuts
      if (editingId) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Fullscreen: F11
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }

      // Quick save & sync to Zotero attachment: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void (async () => {
          if (!(await flushCurrentDocument())) return;
          const latest = latestDocRef.current;
          if (!latest || !isZoteroMode) {
            setSaveStatus({ state: 'saved', message: '已保存到本地' });
            return;
          }
          await zoteroSyncQueueRef.current;
          const result = await saveMindMapToZoteroAttachment(latest);
          setSaveStatus({ state: result.success ? 'saved' : 'warning', message: result.message });
        })().catch((error) => setSaveStatus({ state: 'error', message: `保存失败：${error?.message || error}` }));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        centerCanvas(layout.bounds);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        if (containerRef.current) {
          setViewport({
            x: containerRef.current.clientWidth / 2,
            y: containerRef.current.clientHeight / 2,
            scale: 1,
          });
        }
        return;
      }

      if (e.key === 'F5' || ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setIsPresentationOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        handleOpenSettings();
        return;
      }

      // Clipboard shortcuts: Ctrl+C (Copy), Ctrl+D (Duplicate). Paste is handled
      // by the native paste event so image data remains available.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyNode();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateNode();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAddChild();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleAddSibling(true);
        } else {
          handleAddSibling(false);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteNode();
        return;
      }

      if (e.key === ' ' && selectedId) {
        e.preventDefault();
        setEditingId(selectedId);
        return;
      }

      if (e.key === '?') {
        setIsShortcutsOpen(true);
        return;
      }

      // Directional arrow navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
        e.preventDefault();
        const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const nextId = findAdjacentNode(selectedId, dirMap[e.key], layout.nodes);
        if (nextId) {
          setSelectedId(nextId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingId, selectedId, layout.nodes, isZenMode, flushCurrentDocument, isZoteroMode,
    handleAddChild, handleAddSibling, handleDeleteNode, handleUndo, handleRedo,
    handleCopyNode, handleDuplicateNode
  ]);

  // Create a brand-new independent mind map document for selected literature
  const handleCreateFromZoteroItems = useCallback(() => {
    if (isZoteroMode) {
      const items = getSelectedZoteroItems();
      if (!items || items.length === 0) {
        setSaveStatus({ state: 'warning', message: '请先在 Zotero 文献列表中选中 1 篇或多篇文献。' });
        return;
      }
      void createMindMapFromZoteroItems(items);
    } else {
      const sampleItems = getSampleAcademicItems();
      void createMindMapFromZoteroItems(sampleItems);
    }
  }, [createMindMapFromZoteroItems, isZoteroMode]);

  // Explicitly append selected literature as reference child branches to currently selected node
  const handleAppendZoteroItems = useCallback(() => {
    if (!doc) return;
    if (isZoteroMode) {
      const items = getSelectedZoteroItems();
      if (!items || items.length === 0) {
        setSaveStatus({ state: 'warning', message: '请先在 Zotero 文献列表中选中要追加的文献。' });
        return;
      }

      const parentId = selectedId || doc.root.id;
      let currentRoot = doc.root;
      for (const rawItem of items) {
        const itemData = extractZoteroItemData(rawItem);
        if (itemData) {
          const itemNode = convertZoteroItemToNode(itemData);
          const { newRoot, newNodeId } = addChildNode(currentRoot, parentId, itemNode.text);
          currentRoot = updateNode(newRoot, newNodeId, {
            note: itemNode.note,
            link: itemNode.link,
            tags: itemNode.tags,
            color: itemNode.color,
            children: itemNode.children,
          });
        }
      }

      commitRootChange(currentRoot);
      setSaveStatus({ state: 'saved', message: `已将 ${items.length} 篇文献作为参考分支追加至当前导图！` });
    } else {
      const sampleItems = getSampleAcademicItems();
      const parentId = selectedId || doc.root.id;
      let currentRoot = doc.root;
      for (const itemData of sampleItems) {
        const itemNode = convertZoteroItemToNode(itemData);
        const { newRoot, newNodeId } = addChildNode(currentRoot, parentId, itemNode.text);
        currentRoot = updateNode(newRoot, newNodeId, {
          note: itemNode.note,
          link: itemNode.link,
          tags: itemNode.tags,
          color: itemNode.color,
          children: itemNode.children,
        });
      }
      commitRootChange(currentRoot);
      setSaveStatus({ state: 'saved', message: '已将文献示例作为分支追加至当前导图' });
    }
  }, [addChildNode, commitRootChange, doc, isZoteroMode, selectedId, updateNode]);

  const handleSaveToZoteroNote = useCallback(async () => {
    if (!(await flushCurrentDocument())) return;
    const current = latestDocRef.current;
    if (!current) return;
    const res = await saveMindMapToZoteroNote(current);
    setSaveStatus({ state: res.success ? 'saved' : 'warning', message: res.message });
  }, [flushCurrentDocument]);

  const handleSaveToZoteroAttachment = useCallback(async () => {
    if (!(await flushCurrentDocument())) return;
    const current = latestDocRef.current;
    if (!current) return;
    let parentKey = current.metadata?.zoteroItemKey;
    if (!parentKey && isZoteroMode) {
      const selected = getSelectedZoteroItems();
      if (selected && selected.length > 0) {
        parentKey = selected[0].zoteroUri;
      }
    }
    await zoteroSyncQueueRef.current;
    const res = await saveMindMapToZoteroAttachment(current, parentKey, { silent: false });
    if (res?.success) {
      setSaveStatus({ state: 'saved', message: res.message || '已成功归档至 Zotero 文献条目！' });
    } else {
      setSaveStatus({ state: 'warning', message: res?.message || '归档失败，请检查 Zotero 状态后重试。' });
    }
  }, [flushCurrentDocument, isZoteroMode]);

  // Import file handler
  const handleImportFile = async (file: File) => {
    if (!(await flushCurrentDocument())) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!(await flushCurrentDocument())) return;
      const content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.json')) {
        try {
          if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES) {
            throw new Error('JSON 文件超过 20 MB 安全导入上限');
          }
          const importedDoc = validateMindMapDocument(JSON.parse(content), '导入文件');
          importedDoc.id = 'doc_' + generateId();
          importedDoc.updatedAt = Date.now();
          StorageService.saveDocument(importedDoc).then(async (savedDoc) => {
            await StorageService.setActiveDocumentId(savedDoc.id);
            cleanDocRef.current = savedDoc;
            cleanRelationshipsRef.current = savedDoc.relationships || [];
            setRelationships(cleanRelationshipsRef.current);
            setDoc(savedDoc);
            setSelectedId(importedDoc.root.id);
            setTimeout(() => centerCanvas(), 50);
          }).catch((error) => alert(`导入失败：${error?.message || '无法保存导图'}`));
        } catch (error: any) {
          alert(`JSON 导入失败：${error?.message || '文件格式无效'}`);
        }
      } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const importedRoot = importFromMarkdown(content);
        const newDoc: MindMapDocument = {
          id: 'doc_' + generateId(),
          title: file.name.replace(/\.[^/.]+$/, ''),
          themeId: doc?.themeId || 'classic-blue',
          layoutType: 'mindmap',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          root: importedRoot,
        };
        StorageService.saveDocument(newDoc).then(async (savedDoc) => {
          await StorageService.setActiveDocumentId(savedDoc.id);
          cleanDocRef.current = savedDoc;
          cleanRelationshipsRef.current = [];
          setRelationships(cleanRelationshipsRef.current);
          setDoc(savedDoc);
          setSelectedId(newDoc.root.id);
          setSelectedIds([]);
          setTimeout(() => centerCanvas(), 50);
        }).catch((error) => alert(`Markdown 导入失败：${error?.message || '无法保存导图'}`));
      } else if (file.name.endsWith('.opml')) {
        const importedRoot = importFromOPML(content);
        const newDoc: MindMapDocument = {
          id: 'doc_' + generateId(),
          title: file.name.replace(/\.[^/.]+$/, ''),
          themeId: doc?.themeId || 'classic-blue',
          layoutType: 'mindmap',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          root: importedRoot,
        };
        StorageService.saveDocument(newDoc).then(async (savedDoc) => {
          await StorageService.setActiveDocumentId(savedDoc.id);
          cleanDocRef.current = savedDoc;
          cleanRelationshipsRef.current = [];
          setRelationships(cleanRelationshipsRef.current);
          setDoc(savedDoc);
          setSelectedId(newDoc.root.id);
          setSelectedIds([]);
          setTimeout(() => centerCanvas(), 50);
        }).catch((error) => alert(`OPML 导入失败：${error?.message || '无法保存导图'}`));
      }
    };
    reader.readAsText(file);
  };

  if (!doc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        正在加载思维导图...
      </div>
    );
  }

  const selectedNode = selectedId ? findNode(doc.root, selectedId) : null;
  const inspectorDockSide = dockPosition === 'left' ? 'right' : 'left';

  return (
    <div className={`w-full h-full flex ${settings.toolbarPosition === 'bottom' ? 'flex-col-reverse' : 'flex-col'} overflow-hidden ${theme.isDark ? 'dark' : ''}`}>
      {/* Top Toolbar (Hidden in Zen mode) */}
      {!isZenMode && (
        <Toolbar
          title={doc.title}
          saveStatus={saveStatus}
          onTitleChange={(t) => setDoc(prev => prev ? { ...prev, title: t } : null)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddChild={handleAddChild}
          onImportNodeImage={(file) => { void handleImportNodeImage(file, undefined, true).catch(error => alert(`图片导入失败：${error?.message || '未知错误'}`)); }}
          onAddSibling={() => handleAddSibling(false)}
          onDeleteNode={handleDeleteNode}
          hasSelection={!!selectedId && selectedId !== doc.root.id}
          currentLayout={doc.layoutType}
          onLayoutChange={(l: LayoutType) => setDoc(prev => prev ? { ...prev, layoutType: l } : null)}
          currentThemeId={doc.themeId}
          onThemeChange={(th: string) => setDoc(prev => prev ? { ...prev, themeId: th } : null)}
          scale={viewport.scale}
          onZoomIn={() => setViewport(v => ({ ...v, scale: Math.min(v.scale * (1 + settings.zoomStep), 3.0) }))}
          onZoomOut={() => setViewport(v => ({ ...v, scale: Math.max(v.scale / (1 + settings.zoomStep), 0.25) }))}
          onResetZoom={() => centerCanvas(layout.bounds)}
          isOutlineOpen={isWorkbenchOpen && workbenchTab === 'outline'}
          onToggleOutline={() => {
            if (isWorkbenchOpen && workbenchTab === 'outline') {
              setIsWorkbenchOpen(false);
            } else {
              setWorkbenchTab('outline');
              setIsWorkbenchOpen(true);
            }
          }}
          isInboxOpen={isWorkbenchOpen && workbenchTab === 'inbox'}
          onToggleInbox={() => {
            if (isWorkbenchOpen && workbenchTab === 'inbox') {
              setIsWorkbenchOpen(false);
            } else {
              setWorkbenchTab('inbox');
              setIsWorkbenchOpen(true);
            }
          }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSearch={() => setIsSearchOpen(prev => !prev)}
          onStartPresentation={() => setIsPresentationOpen(true)}
          onFitScreen={() => centerCanvas(layout.bounds)}
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onToggleZen={() => setIsZenMode(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenSettings={handleOpenSettings}
          isPro={true}
          toolbarButtons={settings.toolbarButtons}
          onExportPNG={() => { void exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false }).catch(error => alert(`PNG 导出失败：${error?.message || '图片无法解码'}`)); }}
          onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
          onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
          onExportJSON={() => exportToJSON({ ...doc, relationships })}
          onExportOPML={() => exportToOPML(doc.root, doc.title)}
          onExportHTML={() => exportToInteractiveHTML(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
          onExportPDF={printToPDF}
          onCollapseByLevel={handleCollapseByLevel}
          onImportFile={handleImportFile}
          isSidepanelMode={isSidepanelMode}
          isZoteroMode={isZoteroMode}
          onCreateFromZoteroItems={handleCreateFromZoteroItems}
          onAppendZoteroItems={handleAppendZoteroItems}
          onSaveToZoteroNote={handleSaveToZoteroNote}
          onSaveToZoteroAttachment={handleSaveToZoteroAttachment}
        />
      )}

      {/* Floating Exit Button for Zen Mode */}
      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          title="退出禅模式 (Esc)"
          className="absolute top-4 right-4 z-40 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 shadow-lg rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 flex items-center gap-1.5 border border-purple-200 dark:border-purple-800 transition-all backdrop-blur-md"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>退出专注模式 (Esc)</span>
        </button>
      )}

      {/* Main Workspace Area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden flex">
        {/* Left / Right Workbench (Documents, Outline, Inbox, Backup) */}
        {!isZenMode && (
          <LeftWorkbench
            currentDoc={doc}
            selectedId={selectedId}
            isOpen={isWorkbenchOpen}
            activeTab={workbenchTab}
            dockPosition={dockPosition}
            isZoteroMode={isZoteroMode}
            onToggleOpen={() => setIsWorkbenchOpen(!isWorkbenchOpen)}
            onTabChange={(tab) => setWorkbenchTab(tab)}
            focusedTag={focusedTag}
            onFocusTag={setFocusedTag}
            onToggleDockPosition={handleToggleDockPosition}
            onSelectDoc={(id) => { void openDocumentAt(id); }}
            onNewDoc={() => setIsWelcomeOpen(true)}
            onSelectNode={handleSelectAndCenterNode}
            onUpdateNodeText={(id, text) => handleUpdateNodePatch(id, { text })}
            onAddChildNode={(parentId) => {
              const { newRoot, newNodeId } = addChildNode(doc.root, parentId, '新条目');
              commitRootChange(newRoot);
              setSelectedId(newNodeId);
            }}
            onDeleteNode={(id) => {
              const { newRoot, nextSelectedId } = deleteNode(doc.root, id);
              commitRootChange(newRoot);
              setSelectedId(nextSelectedId);
            }}
            onInsertInboxItem={handleInsertInboxItem}
            onRestoreSnapshot={(restored) => {
              cleanDocRef.current = restored;
              cleanRelationshipsRef.current = restored.relationships || [];
              setDoc(restored);
              setRelationships(restored.relationships || []);
              setSelectedId(restored.root.id);
              historyRef.current.clear();
              syncHistoryState();
              setTimeout(() => centerCanvas(), 50);
            }}
            onReloadWorkspace={reloadWorkspace}
            onFlushCurrentDocument={flushCurrentDocument}
            onOpenSettings={handleOpenSettings}
          />
        )}

        {/* Central Infinite Canvas */}
        <div className="flex-1 h-full relative overflow-hidden">
          <CanvasErrorBoundary rootNode={doc.root} onReset={() => centerCanvas(layout.bounds)}>
            <Canvas
              nodes={layout.nodes}
              connections={layout.connections}
              relationships={relationships}
              bounds={layout.bounds}
              theme={theme}
              selectedId={selectedId}
              selectedIds={selectedIds}
              editingId={editingId}
              viewport={viewport}
              canvasBackground={settings.canvasBackground}
              zoomStep={settings.zoomStep}
              onViewportChange={setViewport}
              onSelectNode={handleSelectNode}
              onSelectMultipleNodes={handleSelectMultipleNodes}
              onStartEditNode={(id) => setEditingId(id)}
              onCommitEditNode={handleCommitEdit}
              onCancelEditNode={() => setEditingId(null)}
              onToggleCollapse={handleToggleCollapse}
              onToggleTaskStatus={handleToggleTaskStatus}
              onOpenInternalLink={(documentId, nodeId) => { void openDocumentAt(documentId, nodeId); }}
              onMoveNode={handleMoveNode}
              searchMatchedIds={searchMatchedIds}
              focusedTag={focusedTag}
              onContextMenuNode={handleContextMenuNode}
              onAddChildNode={handleAddChild}
              onAddSiblingNode={() => handleAddSibling(false)}
              onImportNodeImage={(id, file) => handleImportNodeImage(file, id)}
              onDeleteSelectedNode={(id) => handleDeleteNode(id)}
              onQuickColorNode={(id, color) => handleUpdateNodePatch(id, { color })}
              onCreateRelationship={handleCreateRelationship}
              onDeleteRelationship={handleDeleteRelationship}
              onEditRelationshipLabel={handleEditRelationshipLabel}
              onBatchColor={handleBatchColor}
              onBatchTaskStatus={handleBatchTaskStatus}
              onBatchDelete={handleBatchDelete}
            />
          </CanvasErrorBoundary>

          {/* In-Canvas Search Floating Widget */}
          <CanvasSearch
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            rootNode={doc.root}
            onJumpToNode={handleSelectAndCenterNode}
            onHighlightMatches={setSearchMatchedIds}
            onReplaceCurrent={handleReplaceNodeText}
            onReplaceAll={handleReplaceAllNodeText}
          />

          {/* Minimap Widget (Hidden in Zen or Sidepanel mode) */}
          {!isSidepanelMode && !isZenMode && (
            <div className={`absolute bottom-4 z-20 ${dockPosition === 'left' ? 'right-4' : 'left-4'}`}>
              <Minimap
                nodes={layout.nodes}
                bounds={layout.bounds}
                viewport={viewport}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                onNavigate={(newX, newY) => setViewport(v => ({ ...v, x: newX, y: newY }))}
              />
            </div>
          )}
        </div>

        {/* Opposite Inspector Sidebar (Node Style, Task, Icons, Tags, Note, Link) */}
        {!isZenMode && isPropertySidebarOpen && selectedNode && (
          <PropertySidebar
            selectedNode={selectedNode}
            currentDoc={doc}
            onUpdateNode={handleUpdateNodePatch}
            onImportImage={(id, file) => handleImportNodeImage(file, id)}
            onOpenInternalLink={(documentId, nodeId) => { void openDocumentAt(documentId, nodeId); }}
            onClose={() => setIsPropertySidebarOpen(false)}
            dockSide={inspectorDockSide}
            defaultTaskPriority={settings.defaultTaskPriority}
          />
        )}
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={layout.nodes}
        onSelectAndCenterNode={handleSelectAndCenterNode}
        onAddChild={handleAddChild}
        onAddSibling={() => handleAddSibling(false)}
        onToggleOutline={() => {
          setWorkbenchTab('outline');
          setIsWorkbenchOpen(true);
        }}
        onToggleInbox={() => {
          setWorkbenchTab('inbox');
          setIsWorkbenchOpen(true);
        }}
        onToggleZen={() => setIsZenMode(prev => !prev)}
        onChangeLayout={(l) => setDoc(prev => prev ? { ...prev, layoutType: l } : null)}
        onChangeTheme={(th) => setDoc(prev => prev ? { ...prev, themeId: th } : null)}
        onExportPNG={() => { void exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false }).catch(error => alert(`PNG 导出失败：${error?.message || '图片无法解码'}`)); }}
        onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
        onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
        onExportPDF={printToPDF}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenSettings={handleOpenSettings}
        onCreateBlank={handleCreateBlankDoc}
        onOpenWelcome={() => setIsWelcomeOpen(true)}
      />

      {/* Template Selection Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Welcome / Quick-Start Hub Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        onCreateBlank={handleCreateBlankDoc}
        onImportZotero={handleCreateFromZoteroItems}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onTriggerImportFile={() => importFileInputRef.current?.click()}
        onOpenDocument={(id) => { void openDocumentAt(id); }}
        showOnStartup={settings.showWelcomeOnStartup}
        onToggleShowOnStartup={(val) => {
          setSettings((s) => ({ ...s, showWelcomeOnStartup: val }));
          void SettingsService.updateSettings({ showWelcomeOnStartup: val });
        }}
        isZoteroMode={isZoteroMode}
      />

      {/* Hidden file input for file import from WelcomeModal */}
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,.md,.markdown,.opml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleImportFile(file);
          }
          e.target.value = '';
        }}
      />

      {/* Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Settings & Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          setDockPosition(newSettings.workbenchDockPosition);
        }}
        onReloadWorkspace={reloadWorkspace}
        onFlushCurrentDocument={flushCurrentDocument}
      />

      {/* Node Context Menu (Right Click) */}
      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          node={contextMenuState.node}
          onClose={() => setContextMenuState(null)}
          onAddChild={(id) => {
            const { newRoot, newNodeId } = addChildNode(doc.root, id, '分支主题');
            commitRootChange(newRoot);
            setSelectedId(newNodeId);
            setSelectedIds([]);
            playAddNode(settings.soundEffects);
          }}
          onAddSibling={() => handleAddSibling(false)}
          onDelete={(id) => handleDeleteNode(id)}
          onCopyNode={(id) => handleCopyNode(id, true)}
          onDuplicateNode={(id) => handleDuplicateNode(id)}
          onPasteSubtree={(id) => handlePasteNode(id)}
          hasClipboardContent={!!clipboardSubtreeRef.current}
          onToggleTask={handleToggleTaskStatus}
          onToggleCollapse={handleToggleCollapse}
          onStartEdit={(id) => setEditingId(id)}
          onFocusSubtree={(id) => handleSelectAndCenterNode(id)}
          onLocateZoteroItem={(uri) => locateItemInZotero(uri)}
          onOpenZoteroPdf={(uri) => openItemPdfInZotero(uri)}
        />
      )}

      {/* Fullscreen Presentation Mode */}
      <PresentationMode
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        rootNode={doc.root}
        theme={theme}
      />
    </div>
  );
};
