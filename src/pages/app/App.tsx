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
import { getTheme } from '../../core/theme/themes';
import { TemplateDefinition } from '../../core/model/templates';
import { HistoryManager } from '../../core/history/historyManager';
import { DocumentConflictError, StorageService } from '../../services/storage/storageService';
import {
  exportToPNG, exportToSVG, exportToMarkdown, exportToJSON, importFromMarkdown,
  exportToOPML, importFromOPML, exportToInteractiveHTML, printToPDF
} from '../../services/io/exporter';
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
import { SettingsService } from '../../services/storage/settingsService';
import { BackupService, MAX_BACKUP_BYTES, validateMindMapDocument } from '../../services/storage/backupService';
import { WebDAVService } from '../../services/sync/webdavService';
import { Minimize2 } from 'lucide-react';

interface AppProps {
  isSidepanelMode?: boolean;
}

export const App: React.FC<AppProps> = ({ isSidepanelMode = false }) => {
  const [doc, setDoc] = useState<MindMapDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
  const clipboardSubtreeRef = useRef<MindMapNode | null>(null);

  // Workbench & Sidebar Layout (Ergonomic left-right docking)
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('docs');
  const [dockPosition, setDockPosition] = useState<'left' | 'right'>(() => {
    return (localStorage.getItem('mindflow_dock_pos') as 'left' | 'right') || 'left';
  });

  const [isPropertySidebarOpen, setIsPropertySidebarOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

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
  const pendingSaveTokenRef = useRef(0);
  const autoSyncTimerRef = useRef<number | undefined>(undefined);
  const saveGenerationRef = useRef(0);
  const pendingNavigationRef = useRef<{ documentId: string; nodeId?: string } | null>(null);
  const currentDocIdRef = useRef<string | null>(null);
  currentDocIdRef.current = doc?.id || null;
  latestDocRef.current = doc;
  latestRelationshipsRef.current = relationships;
  useEffect(() => () => window.clearTimeout(autoSyncTimerRef.current), []);

  // Load Settings on mount
  useEffect(() => {
    SettingsService.getSettings().then((loaded) => {
      setSettings(loaded);
      setDockPosition(loaded.workbenchDockPosition);
    });
  }, []);

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

  // Reload current workspace (e.g. after full backup restore)
  const reloadWorkspace = useCallback(() => {
    StorageService.getActiveDocument().then((loadedDoc) => {
      const loadedRelationships = loadedDoc.relationships || [];
      setDoc(loadedDoc);
      setRelationships(loadedRelationships);
      cleanDocRef.current = loadedDoc;
      cleanRelationshipsRef.current = loadedRelationships;
      setSelectedId(loadedDoc.root.id);
      historyRef.current.clear();
      syncHistoryState();
      setTimeout(() => centerCanvas(), 50);
    });
  }, [centerCanvas, syncHistoryState]);

  // Load active document on mount
  useEffect(() => {
    reloadWorkspace();

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
        chrome.runtime.onMessage.removeListener(listener);
        window.removeEventListener('resize', handleResize);
      };
    }

    return () => window.removeEventListener('resize', handleResize);
  }, [reloadWorkspace]);

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
  }, [doc, relationships, settings.webdav, settings.autoSnapshotEnabled, settings.autoSnapshotIntervalMinutes]);

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

  const handleCopyNode = useCallback((idToCopy?: string) => {
    if (!doc) return;
    const targetId = idToCopy || selectedId;
    if (!targetId) return;
    const target = findNode(doc.root, targetId);
    if (target) {
      clipboardSubtreeRef.current = JSON.parse(JSON.stringify(target));
    }
  }, [doc, selectedId]);

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
        status: nextStatus,
        progress: nextStatus === 'done' ? 100 : nextStatus === 'doing' ? 50 : 0,
      },
    });
  }, [doc, handleUpdateNodePatch, settings.soundEffects]);

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
        setIsSettingsOpen(prev => !prev);
        return;
      }

      // Clipboard shortcuts: Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+D (Duplicate)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyNode();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteNode();
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
    editingId, selectedId, layout.nodes, isZenMode,
    handleAddChild, handleAddSibling, handleDeleteNode, handleUndo, handleRedo,
    handleCopyNode, handlePasteNode, handleDuplicateNode
  ]);

  // One-click capture current Chrome tab info
  const handleCaptureCurrentTab = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_INFO' }, (tabInfo) => {
        if (tabInfo && doc) {
          const parentId = selectedId || doc.root.id;
          const { newRoot, newNodeId } = addChildNode(doc.root, parentId, tabInfo.title || '网页链接');
          const finalRoot = updateNode(newRoot, newNodeId, { link: tabInfo.url });
          commitRootChange(finalRoot);
          setSelectedId(newNodeId);
        }
      });
    }
  };

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
          onAddSibling={() => handleAddSibling(false)}
          onDeleteNode={handleDeleteNode}
          hasSelection={!!selectedId && selectedId !== doc.root.id}
          currentLayout={doc.layoutType}
          onLayoutChange={(l: LayoutType) => setDoc(prev => prev ? { ...prev, layoutType: l } : null)}
          currentThemeId={doc.themeId}
          onThemeChange={(th: string) => setDoc(prev => prev ? { ...prev, themeId: th } : null)}
          scale={viewport.scale}
          onZoomIn={() => setViewport(v => ({ ...v, scale: Math.min(v.scale * 1.15, 3.0) }))}
          onZoomOut={() => setViewport(v => ({ ...v, scale: Math.max(v.scale * 0.85, 0.25) }))}
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
          onOpenSettings={() => setIsSettingsOpen(true)}
          isPro={true}
          toolbarButtons={settings.toolbarButtons}
          onExportPNG={() => exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
          onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
          onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
          onExportJSON={() => exportToJSON({ ...doc, relationships })}
          onExportOPML={() => exportToOPML(doc.root, doc.title)}
          onExportHTML={() => exportToInteractiveHTML(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
          onExportPDF={printToPDF}
          onCollapseByLevel={handleCollapseByLevel}
          onImportFile={handleImportFile}
          onCaptureCurrentTab={handleCaptureCurrentTab}
          isSidepanelMode={isSidepanelMode}
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
            onToggleOpen={() => setIsWorkbenchOpen(!isWorkbenchOpen)}
            onTabChange={(tab) => setWorkbenchTab(tab)}
            focusedTag={focusedTag}
            onFocusTag={setFocusedTag}
            onToggleDockPosition={handleToggleDockPosition}
            onSelectDoc={(id) => { void openDocumentAt(id); }}
            onNewDoc={() => setIsTemplateModalOpen(true)}
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
            onOpenSettings={() => setIsSettingsOpen(true)}
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
            onOpenInternalLink={(documentId, nodeId) => { void openDocumentAt(documentId, nodeId); }}
            onClose={() => setIsPropertySidebarOpen(false)}
            dockSide={inspectorDockSide}
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
        onExportPNG={() => exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
        onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title, { watermark: false })}
        onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
        onExportPDF={printToPDF}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Template Selection Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
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
          onCopyNode={(id) => handleCopyNode(id)}
          onDuplicateNode={(id) => handleDuplicateNode(id)}
          onPasteSubtree={(id) => handlePasteNode(id)}
          hasClipboardContent={!!clipboardSubtreeRef.current}
          onToggleTask={handleToggleTaskStatus}
          onToggleCollapse={handleToggleCollapse}
          onStartEdit={(id) => setEditingId(id)}
          onFocusSubtree={(id) => handleSelectAndCenterNode(id)}
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
