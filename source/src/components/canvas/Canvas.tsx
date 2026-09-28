import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  LayoutNode, ConnectionCurve, ViewportTransform, ThemeColors,
  RelationshipLink
} from '../../core/model/types';
import { NodeCard } from '../node/NodeCard';
import {
  Plus, ArrowDown, Edit3, ImagePlus, Link2, Palette, Trash2, X
} from 'lucide-react';

interface CanvasProps {
  nodes: LayoutNode[];
  connections: ConnectionCurve[];
  relationships?: RelationshipLink[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  theme: ThemeColors;
  selectedId: string | null;
  selectedIds?: string[];
  editingId: string | null;
  viewport: ViewportTransform;
  onViewportChange: (vp: ViewportTransform) => void;
  onSelectNode: (id: string | null, isMulti?: boolean) => void;
  onSelectMultipleNodes?: (ids: string[]) => void;
  onStartEditNode: (id: string) => void;
  onCommitEditNode: (id: string, text: string) => void;
  onCancelEditNode: () => void;
  onToggleCollapse: (id: string) => void;
  onOpenInternalLink?: (documentId: string, nodeId?: string) => void;
  onMoveNode: (sourceId: string, targetId: string) => void;
  onContextMenuNode?: (id: string, clientX: number, clientY: number) => void;
  onContextMenuCanvas?: (clientX: number, clientY: number) => void;
  searchMatchedIds?: string[];
  focusedTag?: string | null;
  canvasBackground?: 'dots' | 'grid' | 'blank';
  zoomStep?: number;
  // Micro-toolbar & Relationship actions
  onAddChildNode?: (parentId: string) => void;
  onAddSiblingNode?: () => void;
  onImportNodeImage?: (nodeId: string, file: File) => Promise<void>;
  onDeleteSelectedNode?: (id: string) => void;
  onQuickColorNode?: (id: string, color: string) => void;
  onCreateRelationship?: (fromId: string, toId: string) => void;
  onDeleteRelationship?: (id: string) => void;
  onEditRelationshipLabel?: (id: string, label: string) => void;
  // Multi-selection batch actions
  onBatchColor?: (color: string) => void;
  onBatchDelete?: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  connections,
  relationships = [],
  theme,
  selectedId,
  selectedIds = [],
  editingId,
  viewport,
  onViewportChange,
  onSelectNode,
  onSelectMultipleNodes,
  onStartEditNode,
  onCommitEditNode,
  onCancelEditNode,
  onToggleCollapse,
  onOpenInternalLink,
  onMoveNode,
  onContextMenuNode,
  onContextMenuCanvas,
  searchMatchedIds = [],
  focusedTag = null,
  canvasBackground = 'dots',
  zoomStep = 0.15,
  onAddChildNode,
  onAddSiblingNode,
  onImportNodeImage,
  onDeleteSelectedNode,
  onQuickColorNode,
  onCreateRelationship,
  onDeleteRelationship,
  onEditRelationshipLabel,
  onBatchColor,
  onBatchDelete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetIdRef = useRef<string | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const isSpacePressedRef = useRef(false);

  // Marquee Selection Box state
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [boxCurrent, setBoxCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Floating Micro-toolbar & Relationship Connection states
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [showQuickColors, setShowQuickColors] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          isSpacePressedRef.current = true;
        }
      }
      if (e.key === 'Escape') {
        if (connectingFromId) {
          setConnectingFromId(null);
        }
        setShowQuickColors(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [connectingFromId]);

  // Wheel handling: zoom or pan
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered at mouse pointer
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1 + zoomStep : 1 / (1 + zoomStep);
      const newScale = Math.min(Math.max(viewport.scale * zoomFactor, 0.25), 3.0);

      // Adjust offset so point under mouse remains stable
      const newX = mouseX - (mouseX - viewport.x) * (newScale / viewport.scale);
      const newY = mouseY - (mouseY - viewport.y) * (newScale / viewport.scale);

      onViewportChange({ x: newX, y: newY, scale: newScale });
    } else {
      // Pan with trackpad or mouse wheel
      onViewportChange({
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY,
        scale: viewport.scale,
      });
    }
  }, [viewport, onViewportChange, zoomStep]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Canvas pan / marquee box selection via mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    // Shift + Left Click on canvas -> Marquee box selection
    if (e.shiftKey && e.button === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      setIsSelectingBox(true);
      setBoxStart({ x: startX, y: startY });
      setBoxCurrent({ x: startX, y: startY });
      return;
    }

    // Normal Left click on canvas background, or middle click, or left click with Space pressed
    const isTargetCanvas = (e.target as HTMLElement).classList.contains('canvas-background');
    if (isTargetCanvas || e.button === 1 || isSpacePressedRef.current) {
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
      if (isTargetCanvas) {
        onSelectNode(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelectingBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setBoxCurrent({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      return;
    }

    if (!isDraggingCanvas) return;
    onViewportChange({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
      scale: viewport.scale,
    });
  };

  const handleMouseUp = () => {
    if (isSelectingBox) {
      setIsSelectingBox(false);
      const minX = Math.min(boxStart.x, boxCurrent.x);
      const maxX = Math.max(boxStart.x, boxCurrent.x);
      const minY = Math.min(boxStart.y, boxCurrent.y);
      const maxY = Math.max(boxStart.y, boxCurrent.y);

      // Trigger box selection only if box is larger than 6x6 px
      if (maxX - minX > 6 || maxY - minY > 6) {
        const stageMinX = (minX - viewport.x) / viewport.scale;
        const stageMaxX = (maxX - viewport.x) / viewport.scale;
        const stageMinY = (minY - viewport.y) / viewport.scale;
        const stageMaxY = (maxY - viewport.y) / viewport.scale;

        const hitNodes = nodes.filter((n) => {
          const nodeRight = n.x + n.width;
          const nodeBottom = n.y + n.height;
          return n.x <= stageMaxX && nodeRight >= stageMinX && n.y <= stageMaxY && nodeBottom >= stageMinY;
        });

        if (onSelectMultipleNodes) {
          onSelectMultipleNodes(hitNodes.map((n) => n.id));
        }
      }
      return;
    }

    setIsDraggingCanvas(false);
  };

  // Node Drag & Drop reparenting
  const handleNodeDragStart = (id: string, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    e.dataTransfer.setData('application/x-mindflow-node', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    } else if (draggedNodeId && draggedNodeId !== id) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleNodeDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length !== 1 || !files[0].type.startsWith('image/')) {
        window.alert('请一次拖入一张 PNG、JPEG 或 WebP 图片');
      } else if (onImportNodeImage) {
        void onImportNodeImage(targetId, files[0]).catch(error => {
          window.alert(`图片导入失败：${error?.message || '未知错误'}`);
        });
      }
    } else if (draggedNodeId && draggedNodeId !== targetId && e.dataTransfer.types.includes('application/x-mindflow-node')) {
      onMoveNode(draggedNodeId, targetId);
    }
    setDraggedNodeId(null);
  };

  // Effective set of selected node IDs
  const activeSelectedSet = new Set<string>();
  if (selectedId) activeSelectedSet.add(selectedId);
  for (const id of selectedIds) activeSelectedSet.add(id);

  const activeMicroNode =
    activeSelectedSet.size === 1 && !editingId && !connectingFromId
      ? nodes.find((n) => n.id === selectedId)
      : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        // If clicking on canvas background directly, trigger canvas context menu
        const target = e.target as HTMLElement;
        const isCanvasBg = target === containerRef.current ||
          target.classList.contains('canvas-background') ||
          target.tagName.toLowerCase() === 'svg' ||
          target.id === 'canvas-svg-layer';
        if (isCanvasBg) {
          e.preventDefault();
          onContextMenuCanvas?.(e.clientX, e.clientY);
        }
      }}
      className={`
        relative w-full h-full overflow-hidden select-none canvas-background
        ${theme.isDark ? 'bg-slate-950' : 'bg-slate-50'}
        ${
          canvasBackground === 'blank'
            ? ''
            : canvasBackground === 'grid'
            ? theme.isDark ? 'canvas-grid-lines-dark' : 'canvas-grid-lines'
            : theme.isDark ? 'canvas-grid-dots-dark' : 'canvas-grid-dots'
        }
        ${isDraggingCanvas ? 'cursor-grabbing' : isSelectingBox || connectingFromId ? 'cursor-crosshair' : 'cursor-default'}
      `}
      style={{ backgroundColor: theme.background }}
    >
      <input
        ref={nodeImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="选择当前节点图片"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          const targetId = imageTargetIdRef.current;
          event.target.value = '';
          imageTargetIdRef.current = null;
          if (file && targetId && onImportNodeImage) {
            void onImportNodeImage(targetId, file).catch(error => {
              window.alert(`图片导入失败：${error?.message || '未知错误'}`);
            });
          }
        }}
      />
      {/* Connecting Relationship Banner on Top */}
      {connectingFromId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 z-50 animate-bounce">
          <Link2 className="w-4 h-4" />
          <span>请在画布上点击目标节点以完成关联线连接</span>
          <button
            type="button"
            onClick={() => setConnectingFromId(null)}
            className="ml-2 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] transition-colors"
          >
            ESC 取消
          </button>
        </div>
      )}

      {/* Transformed Stage */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {/* SVG Layer for Connections and Relationships */}
        <svg
          className="absolute overflow-visible w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
            </filter>
            <marker
              id="rel-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8b5cf6" />
            </marker>
          </defs>

          {/* Tree Hierarchical Connections */}
          {connections.map((conn) => (
            <path
              key={conn.id}
              d={conn.path}
              fill="none"
              stroke={conn.color}
              strokeWidth={conn.strokeWidth}
              strokeLinecap="round"
              className={`transition-colors duration-200 ${focusedTag ? 'opacity-25' : ''}`}
            />
          ))}

          {/* Cross-node Relationship Links */}
          {relationships.map((rel) => {
            const from = nodes.find((n) => n.id === rel.fromId);
            const to = nodes.find((n) => n.id === rel.toId);
            if (!from || !to) return null;
            const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
            const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
            const dx = toCenter.x - fromCenter.x;
            const dy = toCenter.y - fromCenter.y;
            const dist = Math.hypot(dx, dy) || 1;
            const curvature = Math.min(Math.max(dist * 0.2, 30), 80);
            const midX = (fromCenter.x + toCenter.x) / 2;
            const midY = (fromCenter.y + toCenter.y) / 2;
            const ctrlX = midX - (dy / dist) * curvature;
            const ctrlY = midY + (dx / dist) * curvature;
            const pathD = `M ${fromCenter.x} ${fromCenter.y} Q ${ctrlX} ${ctrlY} ${toCenter.x} ${toCenter.y}`;
            const strokeColor = rel.color || '#8b5cf6';

            return (
              <path
                key={rel.id}
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeDasharray={rel.style === 'solid' ? undefined : '5,4'}
                markerEnd="url(#rel-arrow)"
                className={`transition-colors duration-200 ${focusedTag ? 'opacity-25' : 'opacity-80 hover:opacity-100'}`}
              />
            );
          })}
        </svg>

        {/* DOM Layer for Interactive Nodes & Relationship Labels */}
        <div className="absolute inset-0 pointer-events-auto">
          {/* Relationship Editable Labels */}
          {relationships.map((rel) => {
            const from = nodes.find((n) => n.id === rel.fromId);
            const to = nodes.find((n) => n.id === rel.toId);
            if (!from || !to) return null;
            const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
            const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
            const dx = toCenter.x - fromCenter.x;
            const dy = toCenter.y - fromCenter.y;
            const dist = Math.hypot(dx, dy) || 1;
            const curvature = Math.min(Math.max(dist * 0.2, 30), 80);
            const midX = (fromCenter.x + toCenter.x) / 2;
            const midY = (fromCenter.y + toCenter.y) / 2;
            const ctrlX = midX - (dy / dist) * curvature;
            const ctrlY = midY + (dx / dist) * curvature;
            const labelX = 0.25 * fromCenter.x + 0.5 * ctrlX + 0.25 * toCenter.x;
            const labelY = 0.25 * fromCenter.y + 0.5 * ctrlY + 0.25 * toCenter.y;

            return (
              <div
                key={`label-${rel.id}`}
                style={{
                  left: `${labelX}px`,
                  top: `${labelY}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute group flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full shadow-md backdrop-blur-xs cursor-pointer hover:scale-105 transition-transform z-30 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextLabel = window.prompt('编辑关联线描述文本:', rel.label || '');
                  if (nextLabel !== null) {
                    onEditRelationshipLabel?.(rel.id, nextLabel.trim());
                  }
                }}
              >
                <Link2 className="w-2.5 h-2.5 opacity-70" />
                <span>{rel.label || '关联'}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRelationship?.(rel.id);
                  }}
                  title="删除此关联线"
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* Mind Map Nodes */}
          {nodes.map((layoutNode) => (
            <NodeCard
              key={layoutNode.id}
              layoutNode={layoutNode}
              isSelected={activeSelectedSet.has(layoutNode.id)}
              isEditing={editingId === layoutNode.id}
              isSearchMatched={searchMatchedIds.includes(layoutNode.id)}
              isTagMatched={Boolean(focusedTag && layoutNode.node.tags?.includes(focusedTag))}
              isTagDimmed={Boolean(focusedTag && !layoutNode.node.tags?.includes(focusedTag) && selectedId !== layoutNode.id)}
              onSelect={(id, e) => {
                e.stopPropagation();
                if (connectingFromId) {
                  if (id !== connectingFromId) {
                    onCreateRelationship?.(connectingFromId, id);
                  }
                  setConnectingFromId(null);
                  return;
                }
                onSelectNode(id, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
              onContextMenu={(id, e) => {
                if (onContextMenuNode) {
                  onContextMenuNode(id, e.clientX, e.clientY);
                }
              }}
              onStartEdit={(id) => onStartEditNode(id)}
              onCommitEdit={(id, text) => onCommitEditNode(id, text)}
              onCancelEdit={onCancelEditNode}
              onToggleCollapse={onToggleCollapse}
              onOpenInternalLink={onOpenInternalLink}
              onDragStart={handleNodeDragStart}
              onDragEnd={() => setDraggedNodeId(null)}
              onDragOver={handleNodeDragOver}
              onDrop={handleNodeDrop}
            />
          ))}

          {/* Floating Micro-Toolbar above Selected Node */}
          {activeMicroNode && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full mb-2.5 flex items-center gap-0.5 p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/80 z-40 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150"
              style={{
                left: `${activeMicroNode.x + activeMicroNode.width / 2}px`,
                top: `${activeMicroNode.y - 6}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onAddChildNode?.(activeMicroNode.id)}
                title="添加子节点 (Tab)"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
              </button>
              <button
                type="button"
                onClick={() => onAddSiblingNode?.()}
                title="添加同级节点 (Enter)"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                type="button"
                onClick={() => onStartEditNode(activeMicroNode.id)}
                title="编辑文字 (Space / 双击)"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                type="button"
                onClick={() => {
                  imageTargetIdRef.current = activeMicroNode.id;
                  nodeImageInputRef.current?.click();
                }}
                title={activeMicroNode.node.image ? '替换当前节点图片' : '插入图片到当前节点'}
                aria-label={activeMicroNode.node.image ? '替换当前节点图片' : '插入图片到当前节点'}
                className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-600 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConnectingFromId(activeMicroNode.id)}
                title="建立跨分支关联线"
                className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-600 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowQuickColors(!showQuickColors)}
                  title="节点快捷换色"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                {showQuickColors && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 z-50">
                    {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          onQuickColorNode?.(activeMicroNode.id, c);
                          setShowQuickColors(false);
                        }}
                        className="w-4 h-4 rounded-full border border-white dark:border-slate-800 shadow-sm hover:scale-125 transition-transform"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => onDeleteSelectedNode?.(activeMicroNode.id)}
                title="删除节点 (Delete)"
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Marquee Selection Box Overlay */}
      {isSelectingBox && (
        <div
          className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/15 rounded-md shadow-sm z-30"
          style={{
            left: Math.min(boxStart.x, boxCurrent.x),
            top: Math.min(boxStart.y, boxCurrent.y),
            width: Math.abs(boxCurrent.x - boxStart.x),
            height: Math.abs(boxCurrent.y - boxStart.y),
          }}
        />
      )}

      {/* Enhanced Multi-selection Floating Batch Toolbar */}
      {activeSelectedSet.size > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur flex items-center gap-3 z-40 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="font-semibold text-blue-400">已多选 {activeSelectedSet.size} 个节点</span>
          <div className="w-px h-3.5 bg-slate-700" />
          {/* Quick Batch Color */}
          <div className="flex items-center gap-1.5">
            {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onBatchColor?.(c)}
                title={`批量设为此主题色`}
                className="w-3.5 h-3.5 rounded-full hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-px h-3.5 bg-slate-700" />
          <button
            type="button"
            onClick={() => onBatchDelete?.()}
            className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900 text-[11px] text-red-300 font-medium flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> 批量删除
          </button>
        </div>
      )}
    </div>
  );
};
