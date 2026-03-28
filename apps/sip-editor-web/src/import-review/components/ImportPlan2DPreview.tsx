import type { CSSProperties } from 'react';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import type { BuildingModel } from '@2wix/shared-types';

const wrap: CSSProperties = {
  marginTop: 8,
  padding: 8,
  borderRadius: 6,
  border: '1px dashed #94a3b8',
  background: '#fff',
};

const W = 420;
const H = 300;
const PAD = 16;

function collectBbox(
  snap: ArchitecturalImportSnapshot | null,
  snap2: ArchitecturalImportSnapshot | null,
  candidate: BuildingModel | null
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of [snap, snap2]) {
    if (!s) continue;
    if (s.outerContour?.points) {
      for (const p of s.outerContour.points) {
        xs.push(p.x);
        ys.push(p.y);
      }
    }
    if (s.walls) {
      for (const w of s.walls) {
        for (const p of w.points ?? []) {
          xs.push(p.x);
          ys.push(p.y);
        }
      }
    }
  }
  if (candidate?.walls) {
    for (const w of candidate.walls) {
      xs.push(w.start.x, w.end.x);
      ys.push(w.start.y, w.end.y);
    }
  }
  if (xs.length === 0) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function project(
  x: number,
  y: number,
  bb: { minX: number; minY: number; maxX: number; maxY: number }
): { x: number; y: number } {
  const bw = Math.max(1, bb.maxX - bb.minX);
  const bh = Math.max(1, bb.maxY - bb.minY);
  const sx = (W - 2 * PAD) / bw;
  const sy = (H - 2 * PAD) / bh;
  const s = Math.min(sx, sy);
  const ox = PAD + (W - 2 * PAD - bw * s) / 2;
  const oy = PAD + (H - 2 * PAD - bh * s) / 2;
  return {
    x: ox + (x - bb.minX) * s,
    y: oy + (bb.maxY - y) * s,
  };
}

function wallLines(
  snap: ArchitecturalImportSnapshot | null,
  bb: { minX: number; minY: number; maxX: number; maxY: number },
  keyPrefix: string,
  extStroke: string,
  intStroke: string,
  width: number,
  dash?: string
) {
  if (!snap?.walls?.length) return null;
  return snap.walls.flatMap((w) =>
    (w.points ?? []).length >= 2
      ? (w.points ?? []).slice(1).map((p2, j) => {
          const p1 = (w.points ?? [])[j]!;
          const a = project(p1.x, p1.y, bb);
          const b = project(p2.x, p2.y, bb);
          const isInt = w.typeHint === 'internal';
          return (
            <line
              key={`${keyPrefix}-${w.id}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isInt ? intStroke : extStroke}
              strokeWidth={width}
              strokeDasharray={dash}
              vectorEffect="non-scaling-stroke"
            />
          );
        })
      : []
  );
}

function contourPath(
  snap: ArchitecturalImportSnapshot | null,
  bb: { minX: number; minY: number; maxX: number; maxY: number },
  stroke: string,
  dash?: string
) {
  const oc = snap?.outerContour;
  const ocPts = oc?.points?.length && oc.points.length >= 2 ? oc.points : null;
  if (!ocPts || oc?.kind !== 'polygon') return null;
  const parts: string[] = [];
  for (let i = 0; i <= ocPts.length; i += 1) {
    const p = ocPts[i % ocPts.length]!;
    const { x, y } = project(p.x, p.y, bb);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return (
    <path
      d={parts.join(' ')}
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray={dash}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function ImportPlan2DPreview({
  rawSnapshot,
  transformedSnapshot,
  candidateModel,
  planImageUrl,
}: {
  rawSnapshot: ArchitecturalImportSnapshot | null;
  /** После apply review (масштаб/решения) — второй слой стен. */
  transformedSnapshot?: ArchitecturalImportSnapshot | null;
  candidateModel: BuildingModel | null;
  /** Первое изображение плана (fileUrl), подложка для сравнения с вектором. */
  planImageUrl?: string | null;
}) {
  if (!rawSnapshot && !transformedSnapshot && !candidateModel) return null;

  const bb = collectBbox(rawSnapshot, transformedSnapshot ?? null, candidateModel);
  if (!bb) {
    return (
      <div style={wrap} data-testid="import-plan-2d-preview">
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>2D диагностика (план)</div>
        <p className="twix-muted" style={{ margin: 0, fontSize: 11 }}>
          Нет координат для предпросмотра.
        </p>
      </div>
    );
  }

  return (
    <div style={wrap} data-testid="import-plan-2d-preview">
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>
        2D диагностика (подложка → контуры → слои)
      </div>
      <div className="twix-muted" style={{ fontSize: 10, marginBottom: 6, lineHeight: 1.5 }}>
        {planImageUrl ? (
          <>
            <span style={{ color: '#64748b' }}>▣</span> фон плана ·{' '}
          </>
        ) : null}
        <span style={{ color: '#15803d' }}>■</span> внешний контур (raw){' '}
        {transformedSnapshot ? (
          <>
            · <span style={{ color: '#0d9488' }}>■</span> контур (transformed){' '}
          </>
        ) : null}
        · <span style={{ color: '#1d4ed8' }}>━</span> стены raw ext · <span style={{ color: '#ea580c' }}>━</span> int ·{' '}
        {transformedSnapshot ? (
          <>
            <span style={{ color: '#0e7490' }}>╍</span> стены transformed ·{' '}
          </>
        ) : null}
        <span style={{ color: '#c026d3' }}>╍</span> candidate
      </div>
      <svg width={W} height={H} style={{ display: 'block', background: '#f8fafc', borderRadius: 4 }}>
        {planImageUrl ? (
          <image
            href={planImageUrl}
            x={0}
            y={0}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.38}
            style={{ pointerEvents: 'none' }}
          />
        ) : null}
        {contourPath(rawSnapshot, bb, '#15803d')}
        {contourPath(transformedSnapshot ?? null, bb, '#0d9488', '4 3')}
        {wallLines(rawSnapshot, bb, 'raw', '#1d4ed8', '#ea580c', 2)}
        {wallLines(transformedSnapshot ?? null, bb, 'tr', '#0e7490', '#f97316', 1.5, '5 4')}
        {candidateModel?.walls?.map((w) => {
          const a = project(w.start.x, w.start.y, bb);
          const b = project(w.end.x, w.end.y, bb);
          return (
            <line
              key={`cand-${w.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#c026d3"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.95}
            />
          );
        })}
      </svg>
    </div>
  );
}
