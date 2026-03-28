import type { FoundationStrip, GroundScreed, Point2D } from '@2wix/shared-types';

function pointsToPath(pts: Point2D[], closed: boolean): string {
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

/** Кольцо: внешний контур + внутренний как отверстие (even-odd). */
function ringPath(outer: Point2D[], inner: Point2D[]): string {
  if (outer.length < 3 || inner.length < 3) return '';
  return `${pointsToPath(outer, true)} ${pointsToPath(inner.slice().reverse(), true)}`;
}

export interface FoundationPlanLayerProps {
  foundation: FoundationStrip | null;
  screed: GroundScreed | null;
  zoom: number;
  foundationVisible: boolean;
  screedVisible: boolean;
  /** Активен слой фундамента — усилить обводку. */
  foundationLayerActive: boolean;
  screedLayerActive: boolean;
  selectedFoundationId: string | null;
  selectedScreedId: string | null;
  onSelectFoundation?: (id: string) => void;
  onSelectScreed?: (id: string) => void;
}

export function FoundationPlanLayer({
  foundation,
  screed,
  zoom,
  foundationVisible,
  screedVisible,
  foundationLayerActive,
  screedLayerActive,
  selectedFoundationId,
  selectedScreedId,
  onSelectFoundation,
  onSelectScreed,
}: FoundationPlanLayerProps) {
  const strokeW = Math.max(2, 80 / zoom);
  const dash = `${400 / zoom} ${200 / zoom}`;
  const patternId = 'twix-screed-hatch';

  return (
    <g style={{ pointerEvents: 'auto' }}>
      <defs>
        <pattern id={patternId} width={300 / zoom} height={300 / zoom} patternUnits="userSpaceOnUse">
          <path
            d={`M 0 ${300 / zoom} L ${300 / zoom} 0`}
            stroke="rgba(71,85,105,0.45)"
            strokeWidth={Math.max(1, 40 / zoom)}
          />
        </pattern>
      </defs>

      {screedVisible && screed && screed.contourMm.length >= 3 ? (
        <path
          d={pointsToPath(screed.contourMm, true)}
          fill={`url(#${patternId})`}
          fillOpacity={0.85}
          stroke={screedLayerActive ? '#0f766e' : '#64748b'}
          strokeWidth={strokeW * (selectedScreedId === screed.id ? 1.4 : 1)}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: onSelectScreed ? 'pointer' : undefined }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectScreed?.(screed.id);
          }}
        />
      ) : null}

      {foundationVisible && foundation && foundation.outerContourMm.length >= 3 ? (
        <path
          d={
            foundation.innerContourMm.length >= 3
              ? ringPath(foundation.outerContourMm, foundation.innerContourMm)
              : pointsToPath(foundation.outerContourMm, true)
          }
          fill={
            foundation.innerContourMm.length >= 3
              ? 'rgba(120, 113, 108, 0.35)'
              : 'rgba(120, 113, 108, 0.2)'
          }
          fillRule={foundation.innerContourMm.length >= 3 ? 'evenodd' : 'nonzero'}
          stroke={foundationLayerActive ? '#78350f' : '#a16207'}
          strokeWidth={strokeW * (selectedFoundationId === foundation.id ? 1.5 : 1)}
          strokeDasharray={foundation.needsRecompute ? dash : undefined}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: onSelectFoundation ? 'pointer' : undefined }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectFoundation?.(foundation.id);
          }}
        />
      ) : null}
    </g>
  );
}
