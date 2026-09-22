import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MindMapDocument, MindMapNode, ViewportTransform, LayoutType, InboxItem, TaskStatus
} from '../../core/model/types';
import {
  addChildNode, addSiblingNode, updateNode, deleteNode,
  toggleNodeCollapse, moveNode, findNode, findAdjacentNode, generateId
} from '../../core/model/treeOps';
import { computeLayout } from '../../core/layout/layoutEngine';
import { getTheme } from '../../core/theme/themes';
import { TemplateDefinition } from '../../core/model/templates';
import { HistoryManager } from '../../core/history/historyManager';
import { StorageService } from '../../services/storage/storageService';
import {
  exportToPNG, exportToSVG, exportToMarkdown, exportToJSON, importFromMarkdown
} from '../../services/io/exporter';
import { Canvas } from '../../components/canvas/Canvas';
import { Toolbar } from '../../components/toolbar/Toolbar';
import { PropertySidebar } from '../../components/sidebar/PropertySidebar';
import { LeftWorkbench, WorkbenchTab } from '../../components/sidebar/LeftWorkbench';
import { ShortcutsModal } from '../../components/modal/ShortcutsModal';
import { TemplateModal } from '../../components/modal/TemplateModal';
import { CommandPalette } from '../../components/command/CommandPalette';
import { Minimap } from '../../components/minimap/Minimap';
import { SettingsModal } from '../../components/modal/SettingsModal';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/model/settingsTypes';
import { SettingsService } from '../../services/storage/settingsService';
import { BackupService } from '../../services/storage/backupService';
import { WebDAVService } from '../../services/sync/webdavService';
import { Minimize2 } from 'lucide-react';

interface AppProps {
  isSidepanelMode?: boolean;
}

export const App: React.FC<AppProps> = ({ isSidepanelMode = false }) => {
  const [doc, setDoc] = useState<MindMapDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });

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

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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
      setDoc(loadedDoc);
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
          StorageService.getActiveDocument().then(setDoc);
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

  // Auto-save debounced with WebDAV auto-sync
  const saveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (!doc) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await StorageService.saveDocument(doc);
      if (settings.webdav.enabled && settings.webdav.autoSyncOnSave) {
        try {
          const backupData = await BackupService.getFullWorkspaceData();
          await WebDAVService.uploadBackup(settings.webdav, backupData);
        } catch {
          // silently handle background sync error
        }
      }
    }, 600);
  }, [doc, settings.webdav]);

  // Theme
  const theme = useMemo(() => {
    return getTheme(doc?.themeId);
  }, [doc?.themeId]);

  // Layout calculation
  const layout = useMemo(() => {
    if (!doc) return { nodes: [], connections: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    return computeLayout(doc.root, doc.layoutType, theme);
  }, [doc, theme]);

  // Commit changes to root and push history
  const commitRootChange = useCallback((newRoot: MindMapNode) => {
    if (!doc) return;
    historyRef.current.push(doc.root);
    syncHistoryState();
    setDoc(prev => prev ? { ...prev, root: newRoot, updatedAt: Date.now() } : null);
  }, [doc, syncHistoryState]);

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
    setEditingId(newNodeId);
  }, [doc, selectedId, settings.autoExpandOnAddChild, commitRootChange]);

  const handleAddSibling = useCallback((insertBefore = false) => {
    if (!doc) return;
    const targetId = selectedId || doc.root.id;
    const { newRoot, newNodeId } = addSiblingNode(doc.root, targetId, '分支主题', insertBefore);
    commitRootChange(newRoot);
    setSelectedId(newNodeId);
    setEditingId(newNodeId);
  }, [doc, selectedId, commitRootChange]);

  const handleDeleteNode = useCallback(() => {
    if (!doc || !selectedId || selectedId === doc.root.id) return;
    const { newRoot, nextSelectedId } = deleteNode(doc.root, selectedId);
    commitRootChange(newRoot);
    setSelectedId(nextSelectedId);
  }, [doc, selectedId, commitRootChange]);

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

    handleUpdateNodePatch(id, {
      task: {
        ...(target.task || {}),
        status: nextStatus,
        progress: nextStatus === 'done' ? 100 : nextStatus === 'doing' ? 50 : 0
      }
    });
  }, [doc, handleUpdateNodePatch]);

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
    const newDoc: MindMapDocument = {
      id: 'doc_' + generateId(),
      title: tpl.title,
      themeId: tpl.themeId,
      layoutType: tpl.layoutType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      root: tpl.createRoot(),
    };
    await StorageService.saveDocument(newDoc);
    await StorageService.setActiveDocumentId(newDoc.id);
    setDoc(newDoc);
    setSelectedId(newDoc.root.id);
    historyRef.current.clear();
    syncHistoryState();
    setTimeout(() => centerCanvas(), 50);
  }, [centerCanvas, syncHistoryState]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Zen mode escape
      if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
        return;
      }

      // If editing text in input or textarea, skip global shortcuts
      if (editingId) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

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
    handleAddChild, handleAddSibling, handleDeleteNode, handleUndo, handleRedo
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
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.json')) {
        try {
          const importedDoc = JSON.parse(content) as MindMapDocument;
          importedDoc.id = 'doc_' + generateId();
          importedDoc.updatedAt = Date.now();
          StorageService.saveDocument(importedDoc).then(() => {
            setDoc(importedDoc);
            setSelectedId(importedDoc.root.id);
            setTimeout(() => centerCanvas(), 50);
          });
        } catch {
          alert('JSON 文件格式无效，无法解析。');
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
        StorageService.saveDocument(newDoc).then(() => {
          setDoc(newDoc);
          setSelectedId(newDoc.root.id);
          setTimeout(() => centerCanvas(), 50);
        });
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
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onToggleZen={() => setIsZenMode(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          toolbarButtons={settings.toolbarButtons}
          onExportPNG={() => exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title)}
          onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title)}
          onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
          onExportJSON={() => exportToJSON(doc)}
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
            onToggleDockPosition={handleToggleDockPosition}
            onSelectDoc={async (id) => {
              const selectedDoc = await StorageService.getDocument(id);
              if (selectedDoc) {
                await StorageService.setActiveDocumentId(id);
                setDoc(selectedDoc);
                setSelectedId(selectedDoc.root.id);
                historyRef.current.clear();
                syncHistoryState();
                setTimeout(() => centerCanvas(), 50);
              }
            }}
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
              setDoc(restored);
              setSelectedId(restored.root.id);
              historyRef.current.clear();
              syncHistoryState();
              setTimeout(() => centerCanvas(), 50);
            }}
            onReloadWorkspace={reloadWorkspace}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* Central Infinite Canvas */}
        <div className="flex-1 h-full relative overflow-hidden">
          <Canvas
            nodes={layout.nodes}
            connections={layout.connections}
            bounds={layout.bounds}
            theme={theme}
            selectedId={selectedId}
            editingId={editingId}
            viewport={viewport}
            canvasBackground={settings.canvasBackground}
            onViewportChange={setViewport}
            onSelectNode={(id) => {
              setSelectedId(id);
              if (id && !isZenMode) {
                setIsPropertySidebarOpen(true);
              }
            }}
            onStartEditNode={(id) => setEditingId(id)}
            onCommitEditNode={handleCommitEdit}
            onCancelEditNode={() => setEditingId(null)}
            onToggleCollapse={handleToggleCollapse}
            onToggleTaskStatus={handleToggleTaskStatus}
            onMoveNode={handleMoveNode}
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
            onUpdateNode={handleUpdateNodePatch}
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
        onExportPNG={() => exportToPNG(layout.nodes, layout.connections, layout.bounds, theme, doc.title)}
        onExportSVG={() => exportToSVG(layout.nodes, layout.connections, layout.bounds, theme, doc.title)}
        onExportMarkdown={() => exportToMarkdown(doc.root, doc.title)}
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
      />
    </div>
  );
};
