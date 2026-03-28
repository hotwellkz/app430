import type { Opening, Wall } from '@2wix/shared-types';
import { computeOpeningFootprintCorners, openingCenterWorldMm } from '@2wix/domain-model';

interface OpeningsLayerProps {
  openings: Opening[];
  wallById: Map<string, Wall>;
  selectedOpeningId: string | null;
  hoveredOpeningId: string | null;
  viewZoom?: number;
}

function openingFill(o: Opening, selected: boolean, hovered: boolean): string {
  if (selected) return 'rgba(251,191,36,0.55)';
  if (hovered) return 'rgba(253,224,71,0.4)';
  switch (o.openingType) {
    case 'window':
      return 'rgba(125,211,252,0.65)';
    case 'door':
      return 'rgba(167,139,250,0.6)';
    case 'portal':
      return 'rgba(52,211,153,0.55)';
    default:
      return 'rgba(148,163,184,0.5)';
  }
}

function openingStroke(o: Opening, selected: boolean): string {
  if (selected) return '#b45309';
  switch (o.openingType) {
    case 'window':
      return '#0369a1';
    case 'door':
      return '#6d28d9';
    case 'portal':
      return '#047857';
    default:
      return '#475569';
  }
}

function typeAbbr(o: Opening): string {
  switch (o.openingType) {
    case 'window':
      return 'О';
    case 'door':
      return 'Д';
    case 'portal':
      return 'П';
    default:
      return '?';
  }
}

export function OpeningsLayer({
  openings,
  wallById,
  selectedOpeningId,
  hoveredOpeningId,
  viewZoom = 1,
}: OpeningsLayerProps) {
  const z = Math.max(0.15, Math.min(4, viewZoom));
  const fontSize = Math.max(160, Math.min(650, 340 / z));

  return (
    <g className="sip-openings-layer">
      {openings.map((o) => {
        const wall = wallById.get(o.wallId);
        if (!wall) return null;
        const [p1, p2, p3, p4] = computeOpeningFootprintCorners(o, wall);
        const pts = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
        const sel = o.id === selectedOpeningId;
        const hov = o.id === hoveredOpeningId;
        const c = openingCenterWorldMm(o, wall);
        const label = `${typeAbbr(o)} ${Math.round(o.widthMm)}`;

        return (
          <g key={o.id} data-opening-id={o.id}>
            <polygon
              points={pts}
              fill={openingFill(o, sel, hov)}
              stroke={openingStroke(o, sel)}
              strokeWidth={sel ? 2 : 1}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="miter"
            />
            <text
              x={c.x}
              y={c.y}
              fill="#0f172a"
              fontSize={fontSize}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              style={{ userSelect: 'none' }}
              stroke="rgba(255,255,255,0.88)"
              strokeWidth={Math.max(14, fontSize * 0.12)}
              paintOrder="stroke fill"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
