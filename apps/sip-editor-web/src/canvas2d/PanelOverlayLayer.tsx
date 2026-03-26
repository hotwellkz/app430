import { findWallById } from '@2wix/domain-model';
import type { BuildingModel } from '@2wix/shared-types';
import type { GeneratedPanel } from '@2wix/panel-engine';

interface PanelOverlayLayerProps {
  model: BuildingModel;
  panels: GeneratedPanel[];
  selectedWallId: string | null;
  showLabels: boolean;
}

function axisPoint(wallStart: { x: number; y: number }, wallEnd: { x: number; y: number }, t: number) {
  const dx = wallEnd.x - wallStart.x;
  const dy = wallEnd.y - wallStart.y;
  return {
    x: wallStart.x + dx * t,
    y: wallStart.y + dy * t,
  };
}

export function PanelOverlayLayer({ model, panels, selectedWallId, showLabels }: PanelOverlayLayerProps) {
  return (
    <g>
      {panels.map((p) => {
        const wall = findWallById(model, p.sourceId);
        if (!wall) return null;
        const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        if (len < 1) return null;
        const startRatio = p.originXmm / len;
        const endRatio = (p.originXmm + p.widthMm) / len;
        const a = axisPoint(wall.start, wall.end, startRatio);
        const b = axisPoint(wall.start, wall.end, endRatio);
        const nx = (wall.end.y - wall.start.y) / len;
        const ny = -(wall.end.x - wall.start.x) / len;
        const rowOffset = p.orientation === 'horizontal' ? Math.min(180, p.originYmm * 0.03) : 0;
        const offset = wall.thicknessMm * 0.8 + rowOffset;
        const x1 = a.x + nx * offset;
        const y1 = a.y + ny * offset;
        const x2 = b.x + nx * offset;
        const y2 = b.y + ny * offset;
        const selected = selectedWallId === p.sourceId;
        const stroke = selected ? '#7c3aed' : '#64748b';
        return (
          <g key={p.id}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={selected ? 110 : 70}
              vectorEffect="non-scaling-stroke"
            />
            {showLabels && selected ? (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 90}
                textAnchor="middle"
                fontSize={180}
                fill={stroke}
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
