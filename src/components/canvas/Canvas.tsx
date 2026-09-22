import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LayoutNode, ConnectionCurve, ViewportTransform, ThemeColors } from '../../core/model/types';
import { NodeCard } from '../node/NodeCard';

interface CanvasProps {
  nodes: LayoutNode[];
  connections: ConnectionCurve[];
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
  onToggleTaskStatus?: (id: string) => void;
  onMoveNode: (sourceId: string, targetId: string) => void;
  onContextMenuNode?: (id: string, clientX: number, clientY: number) => void;
  searchMatchedIds?: string[];
  canvasBackground?: 'dots' | 'grid' | 'blank';
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  connections,
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
  onToggleTaskStatus,
  onMoveNode,
  onContextMenuNode,
  searchMatchedIds = [],
  canvasBackground = 'dots',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const isSpacePressedRef = useRef(false);

  // Marquee Selection Box state
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [boxCurrent, setBoxCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          isSpacePressedRef.current = true;
        }
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
  }, []);

  // Wheel handling: zoom or pan
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered at mouse pointer
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
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
  }, [viewport, onViewportChange]);

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
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNodeId && draggedNodeId !== id) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleNodeDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNodeId && draggedNodeId !== targetId) {
      onMoveNode(draggedNodeId, targetId);
    }
    setDraggedNodeId(null);
  };

  // Effective set of selected node IDs
  const activeSelectedSet = new Set<string>();
  if (selectedId) activeSelectedSet.add(selectedId);
  for (const id of selectedIds) activeSelectedSet.add(id);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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
        ${isDraggingCanvas ? 'cursor-grabbing' : isSelectingBox ? 'cursor-crosshair' : 'cursor-default'}
      `}
      style={{ backgroundColor: theme.background }}
    >
      {/* Transformed Stage */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {/* SVG Layer for Connections */}
        <svg
          className="absolute overflow-visible w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
            </filter>
          </defs>
          {connections.map((conn) => (
            <path
              key={conn.id}
              d={conn.path}
              fill="none"
              stroke={conn.color}
              strokeWidth={conn.strokeWidth}
              strokeLinecap="round"
              className="transition-colors duration-200"
            />
          ))}
        </svg>

        {/* DOM Layer for Interactive Nodes */}
        <div className="absolute inset-0 pointer-events-auto">
          {nodes.map((layoutNode) => (
            <NodeCard
              key={layoutNode.id}
              layoutNode={layoutNode}
              isSelected={activeSelectedSet.has(layoutNode.id)}
              isEditing={editingId === layoutNode.id}
              isSearchMatched={searchMatchedIds.includes(layoutNode.id)}
              onSelect={(id, e) => {
                e.stopPropagation();
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
              onToggleTaskStatus={onToggleTaskStatus}
              onDragStart={handleNodeDragStart}
              onDragOver={handleNodeDragOver}
              onDrop={handleNodeDrop}
            />
          ))}
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

      {/* Multi-selection Floating Indicator */}
      {activeSelectedSet.size > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur flex items-center gap-3 z-40 border border-slate-700">
          <span className="font-semibold text-blue-400">已多选 {activeSelectedSet.size} 个节点</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">Ctrl+C 复制 / Ctrl+D 创建副本 / Del 批量删除</span>
        </div>
      )}
    </div>
  );
};
