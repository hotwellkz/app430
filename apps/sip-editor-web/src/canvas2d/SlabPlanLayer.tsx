import type { Slab } from '@2wix/shared-types';

function pointsToPath(pts: { x: number; y: number }[], closed: boolean): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    d += ` L ${p.x} ${p.y}`;
  }
  if (closed) d += ' Z';
  return d;
}

export interface SlabPlanLayerProps {
  slabs: Slab[];
  zoom: number;
  layerActive: boolean;
  selectedSlabId: string | null;
  onSelectSlab?: (id: string) => void;
}

export function SlabPlanLayer({ slabs, zoom, layerActive, selectedSlabId, onSelectSlab }: SlabPlanLayerProps) {
  const strokeW = Math.max(2, 70 / zoom);
  const patternId = 'twix-slab-hatch';

  return (
    <g style={{ pointerEvents: 'auto' }}>
      <defs>
        <pattern id={patternId} width={400 / zoom} height={400 / zoom} patternUnits="userSpaceOnUse">
          <path
            d={`M 0 ${400 / zoom} L ${400 / zoom} 0`}
            stroke="rgba(2,132,199,0.35)"
            strokeWidth={Math.max(1, 35 / zoom)}
          />
        </pattern>
      </defs>
      {slabs.map((slab) => {
        const contour = slab.contourMm;
        if (!contour || contour.length < 3) return null;
        const d = pointsToPath(contour, true);
        const sel = selectedSlabId === slab.id;
        return (
          <path
            key={slab.id}
            d={d}
            fill={`url(#${patternId})`}
            fillOpacity={0.55}
            stroke={layerActive ? '#0369a1' : '#0284c7'}
            strokeWidth={strokeW * (sel ? 1.45 : 1)}
            strokeDasharray={slab.needsRecompute ? `${400 / zoom} ${200 / zoom}` : undefined}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: onSelectSlab ? 'pointer' : undefined }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectSlab?.(slab.id);
            }}
          />
        );
      })}
    </g>
  );
}
