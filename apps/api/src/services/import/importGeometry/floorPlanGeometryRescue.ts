import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import {
  countWallSegmentsByTypeHint,
  distanceMm,
} from './geom2d.js';

const MIN_EDGE_MM = 100;

export interface GeometryRescueMetrics {
  externalSegmentsBefore: number;
  internalSegmentsBefore: number;
  externalSegmentsAfterSnap: number;
  internalSegmentsAfterSnap: number;
  externalSegmentsFinal: number;
  internalSegmentsFinal: number;
}

function contourToExternalWallEntries(
  contour: NonNullable<ArchitecturalImportSnapshot['outerContour']>,
  floorId: string
): ArchitecturalImportSnapshot['walls'] {
  const pts = contour.points;
  if (!Array.isArray(pts) || pts.length < 3) return [];
  const closeLoop = contour.kind === 'polygon' ? 1 : 0;
  const walls: ArchitecturalImportSnapshot['walls'] = [];
  let idx = 0;
  for (let i = 1; i < pts.length + closeLoop; i += 1) {
    const p1 = pts[i - 1]!;
    const p2 = pts[i % pts.length]!;
    if (distanceMm(p1, p2) < MIN_EDGE_MM) continue;
    idx += 1;
    walls.push({
      id: `rescue-outer-${idx}`,
      floorId,
      points: [p1, p2],
      typeHint: 'external',
      thicknessHintMm: 163,
    });
  }
  return walls;
}

/**
 * Кластеризация узлов в пределах tolerance: общие концы стен/контура сливаются (среднее).
 */
export function snapWallAndContourEndpoints(
  snapshot: ArchitecturalImportSnapshot,
  toleranceMm: number
): ArchitecturalImportSnapshot {
  const out = JSON.parse(JSON.stringify(snapshot)) as ArchitecturalImportSnapshot;
  const coords: Array<{ x: number; y: number }> = [];

  const contourPts = out.outerContour?.points;
  const contourLen = contourPts?.length ?? 0;
  if (contourPts) {
    for (const p of contourPts) coords.push({ x: p.x, y: p.y });
  }
  const wallPointCounts: number[] = [];
  if (Array.isArray(out.walls)) {
    for (const w of out.walls) {
      const m = w.points?.length ?? 0;
      wallPointCounts.push(m);
      for (const p of w.points ?? []) coords.push({ x: p.x, y: p.y });
    }
  }

  const n = coords.length;
  if (n === 0) return out;

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    return parent[i] === i ? i : (parent[i] = find(parent[i]!));
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (distanceMm(coords[i]!, coords[j]!) <= toleranceMm) union(i, j);
    }
  }

  const sum: Array<{ x: number; y: number; c: number }> = [];
  for (let i = 0; i < n; i += 1) sum.push({ x: 0, y: 0, c: 0 });
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    sum[r]!.x += coords[i]!.x;
    sum[r]!.y += coords[i]!.y;
    sum[r]!.c += 1;
  }

  const newPos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const s = sum[r]!;
    newPos[i] = { x: s.x / s.c, y: s.y / s.c };
  }

  if (out.outerContour?.points && contourLen > 0) {
    for (let pi = 0; pi < contourLen; pi += 1) {
      out.outerContour.points[pi] = { ...newPos[pi]! };
    }
  }
  let off = contourLen;
  if (Array.isArray(out.walls)) {
    out.walls = out.walls.map((w, wi) => {
      const m = wallPointCounts[wi] ?? 0;
      const nextPts = (w.points ?? []).map((p, pi) => {
        const idx = off + pi;
        return { ...newPos[idx]! };
      });
      off += m;
      return { ...w, points: nextPts };
    });
  }

  return out;
}

export interface GeometryRescuePassResult {
  snapshot: ArchitecturalImportSnapshot;
  notes: string[];
  reasonCodes: string[];
  metrics: GeometryRescueMetrics;
  mixedContourSupplement: boolean;
}

/**
 * Детерминированный rescue: снап узлов + при отсутствии внешних сегментов — кольцо по outerContour
 * наряду с внутренними/прочими стенами AI (без удаления валидных полилиний).
 */
export function runGeometryRescuePass(
  snapshot: ArchitecturalImportSnapshot,
  floorId: string,
  options?: { endpointToleranceMm?: number }
): GeometryRescuePassResult {
  const tol = options?.endpointToleranceMm ?? 45;
  const notes: string[] = [];
  const reasonCodes: string[] = [];

  let working = JSON.parse(JSON.stringify(snapshot)) as ArchitecturalImportSnapshot;

  const before = countWallSegmentsByTypeHint(working.walls ?? []);
  reasonCodes.push('RESCUE_METRICS_BEFORE_SNAP');

  working = snapWallAndContourEndpoints(working, tol);
  notes.push(`geometryRescue: endpoint snap tolerance=${tol}mm (union-find)`);
  reasonCodes.push('ENDPOINT_CLUSTER_SNAP');

  const afterSnap = countWallSegmentsByTypeHint(working.walls ?? []);

  let mixedContourSupplement = false;
  const oc = working.outerContour;
  const hasContour = Boolean(oc?.points && oc.points.length >= 3);

  /** Только внутренние сегменты при валидном контуре — добавляем периметр, не удаляя AI. */
  if (hasContour && afterSnap.external === 0 && afterSnap.internal > 0 && oc) {
    const ring = contourToExternalWallEntries(oc, floorId);
    if (ring.length > 0) {
      const internals = (working.walls ?? []).filter((w) => w.typeHint === 'internal');
      const other = (working.walls ?? []).filter((w) => w.typeHint !== 'internal');
      working.walls = [...ring, ...internals, ...other];
      mixedContourSupplement = true;
      notes.push(
        `geometryRescue: нет внешних сегментов — добавлено кольцо по outerContour (${ring.length} сегм.), внутренние AI сохранены (${internals.length} полилиний)`
      );
      reasonCodes.push('MIXED_CONTOUR_RING_SUPPLEMENT_NO_EXTERNAL');
    }
  }

  const finalC = countWallSegmentsByTypeHint(working.walls ?? []);

  const metrics: GeometryRescueMetrics = {
    externalSegmentsBefore: before.external,
    internalSegmentsBefore: before.internal,
    externalSegmentsAfterSnap: afterSnap.external,
    internalSegmentsAfterSnap: afterSnap.internal,
    externalSegmentsFinal: finalC.external,
    internalSegmentsFinal: finalC.internal,
  };

  return {
    snapshot: working,
    notes,
    reasonCodes,
    metrics,
    mixedContourSupplement,
  };
}
