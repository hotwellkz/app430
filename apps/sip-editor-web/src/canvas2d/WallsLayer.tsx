import type { Wall } from '@2wix/shared-types';
import { wallPolygonPointsMm } from './wallOutline.js';

interface WallsLayerProps {
  walls: Wall[];
  selectedWallId: string | null;
  hoveredWallId: string | null;
}

function wallFill(w: Wall, selected: boolean, hovered: boolean): string {
  if (selected) return 'rgba(37,99,235,0.35)';
  if (hovered) return 'rgba(59,130,246,0.22)';
  return w.wallType === 'internal' ? 'rgba(148,163,184,0.55)' : 'rgba(51,65,85,0.65)';
}

function wallStroke(w: Wall, selected: boolean): string {
  if (selected) return '#1d4ed8';
  return w.wallType === 'internal' ? '#64748b' : '#1e293b';
}

export function WallsLayer({ walls, selectedWallId, hoveredWallId }: WallsLayerProps) {
  return (
    <g className="sip-walls-layer">
      {walls.map((w) => {
        const sel = w.id === selectedWallId;
        const hov = w.id === hoveredWallId;
        return (
          <polygon
            key={w.id}
            data-wall-id={w.id}
            points={wallPolygonPointsMm(w)}
            fill={wallFill(w, sel, hov)}
            stroke={wallStroke(w, sel)}
            strokeWidth={sel ? 2 : 1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
        );
      })}
    </g>
  );
}
