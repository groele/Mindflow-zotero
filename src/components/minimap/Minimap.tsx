import React from 'react';
import { LayoutNode, ViewportTransform } from '../../core/model/types';
import { MapPin } from 'lucide-react';

interface MinimapProps {
  nodes: LayoutNode[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  viewport: ViewportTransform;
  containerWidth: number;
  containerHeight: number;
  onNavigate: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  bounds,
  viewport,
  containerWidth,
  containerHeight,
  onNavigate,
}) => {
  const mapWidth = 180;
  const mapHeight = 120;
  const padding = 60;

  const totalWidth = Math.max(bounds.maxX - bounds.minX + padding * 2, 400);
  const totalHeight = Math.max(bounds.maxY - bounds.minY + padding * 2, 300);

  const scale = Math.min(mapWidth / totalWidth, mapHeight / totalHeight);

  // Offset to center content inside minimap
  const offsetX = (mapWidth - totalWidth * scale) / 2 - (bounds.minX - padding) * scale;
  const offsetY = (mapHeight - totalHeight * scale) / 2 - (bounds.minY - padding) * scale;

  // Viewport box in world coords:
  // worldX = -viewport.x / viewport.scale
  // worldY = -viewport.y / viewport.scale
  // worldW = containerWidth / viewport.scale
  // worldH = containerHeight / viewport.scale
  const vpWorldX = -viewport.x / viewport.scale;
  const vpWorldY = -viewport.y / viewport.scale;
  const vpWorldW = containerWidth / viewport.scale;
  const vpWorldH = containerHeight / viewport.scale;

  const vpMinimapX = vpWorldX * scale + offsetX;
  const vpMinimapY = vpWorldY * scale + offsetY;
  const vpMinimapW = vpWorldW * scale;
  const vpMinimapH = vpWorldH * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click in minimap to world coordinates
    const targetWorldX = (clickX - offsetX) / scale;
    const targetWorldY = (clickY - offsetY) / scale;

    // Center viewport on clicked point
    const newVpX = -(targetWorldX * viewport.scale - containerWidth / 2);
    const newVpY = -(targetWorldY * viewport.scale - containerHeight / 2);

    onNavigate(newVpX, newVpY);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-[180px] h-[120px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg overflow-hidden cursor-crosshair group"
      title="小地图导航（点击快速平移）"
    >
      <div className="absolute top-1.5 left-2 text-[10px] font-medium text-slate-400 flex items-center gap-1 pointer-events-none select-none">
        <MapPin className="w-2.5 h-2.5" /> 导航
      </div>

      {/* Render miniature nodes */}
      <svg className="w-full h-full pointer-events-none">
        {nodes.map((n) => {
          const mx = n.x * scale + offsetX;
          const my = n.y * scale + offsetY;
          const mw = Math.max(n.width * scale, 3);
          const mh = Math.max(n.height * scale, 2);

          return (
            <rect
              key={n.id}
              x={mx}
              y={my}
              width={mw}
              height={mh}
              rx={1}
              fill={n.level === 0 ? '#3b82f6' : (n.level === 1 ? n.color : '#94a3b8')}
              opacity={0.8}
            />
          );
        })}

        {/* Viewport rectangle */}
        <rect
          x={vpMinimapX}
          y={vpMinimapY}
          width={Math.max(vpMinimapW, 8)}
          height={Math.max(vpMinimapH, 6)}
          fill="rgba(59, 130, 246, 0.12)"
          stroke="#3b82f6"
          strokeWidth="1.5"
          rx={2}
        />
      </svg>
    </div>
  );
};
