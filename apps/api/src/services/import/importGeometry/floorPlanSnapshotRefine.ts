import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { distanceMm } from './geom2d.js';

const DEFAULT_GRID_MM = 10;
/** Макс. отклонение средней точки от прямой между соседями (мм), чтобы считать её коллинеарной. */
const COLLINEAR_MAX_DEVIATION_MM = 8;

function snapMm(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

function snapPoint(p: { x: number; y: number }, grid: number): { x: number; y: number } {
  return { x: snapMm(p.x, grid), y: snapMm(p.y, grid) };
}

function pointToSegmentDeviationSq(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return 0;
  const t = Math.max(0, Math.min(1, ((b.x - a.x) * dx + (b.y - a.y) * dy) / len2));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  const ex = b.x - px;
  const ey = b.y - py;
  return ex * ex + ey * ey;
}

/** Удаляем среднюю точку, если три последовательные почти на одной линии (open polyline). */
function simplifyPolylineOpen(
  points: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  const out: Array<{ x: number; y: number }> = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const dev = Math.sqrt(pointToSegmentDeviationSq(a, b, c));
    if (dev <= COLLINEAR_MAX_DEVIATION_MM) {
      continue;
    }
    out.push(b);
  }
  out.push(points[points.length - 1]!);
  return out;
}

function dedupeConsecutive(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length === 0) return points;
  const out: Array<{ x: number; y: number }> = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]!;
    const prev = out[out.length - 1]!;
    if (distanceMm(prev, p) < 1) continue;
    out.push(p);
  }
  return out;
}

/**
 * Детерминированное уточнение координат плана: привязка к сетке и упрощение полилиний
 * (без доступа к растру — только геометрия snapshot после AI).
 */
export function refineArchitecturalSnapshotGeometry(
  snapshot: ArchitecturalImportSnapshot,
  options?: { gridMm?: number }
): { snapshot: ArchitecturalImportSnapshot; notes: string[] } {
  const grid = options?.gridMm ?? DEFAULT_GRID_MM;
  const notes: string[] = [];
  const out = JSON.parse(JSON.stringify(snapshot)) as ArchitecturalImportSnapshot;

  if (out.outerContour?.points?.length) {
    out.outerContour.points = dedupeConsecutive(
      out.outerContour.points.map((p: { x: number; y: number }) => snapPoint(p, grid))
    );
  }

  if (Array.isArray(out.walls)) {
    out.walls = out.walls.map((w: ArchitecturalImportSnapshot['walls'][number]) => {
      const pts = Array.isArray(w.points) ? w.points : [];
      const snapped = dedupeConsecutive(pts.map((p) => snapPoint(p, grid)));
      const simplified = simplifyPolylineOpen(snapped);
      return { ...w, points: simplified };
    });
  }

  notes.push(`floorPlanSnapshotRefine: grid=${grid}mm, collinear simplify (open polylines)`);
  return { snapshot: out, notes };
}
