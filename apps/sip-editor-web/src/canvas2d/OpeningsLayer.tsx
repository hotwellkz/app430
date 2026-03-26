import type { Opening, Wall } from '@2wix/shared-types';
import { computeOpeningFootprintCorners } from '@2wix/domain-model';

interface OpeningsLayerProps {
  openings: Opening[];
  wallById: Map<string, Wall>;
  selectedOpeningId: string | null;
  hoveredOpeningId: string | null;
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

export function OpeningsLayer({
  openings,
  wallById,
  selectedOpeningId,
  hoveredOpeningId,
}: OpeningsLayerProps) {
  return (
    <g className="sip-openings-layer">
      {openings.map((o) => {
        const wall = wallById.get(o.wallId);
        if (!wall) return null;
        const [p1, p2, p3, p4] = computeOpeningFootprintCorners(o, wall);
        const pts = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
        const sel = o.id === selectedOpeningId;
        const hov = o.id === hoveredOpeningId;
        return (
          <polygon
            key={o.id}
            data-opening-id={o.id}
            points={pts}
            fill={openingFill(o, sel, hov)}
            stroke={openingStroke(o, sel)}
            strokeWidth={sel ? 2 : 1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
        );
      })}
    </g>
  );
}
