import type { Point2D, Wall } from '@2wix/shared-types';
import { FOUNDATION_WALL_ENDPOINT_TOL_MM } from './foundationConstants.js';
import { wallFootprintCorners } from './wallGeometry.js';

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polygonAreaSigned(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Пересечение прямых (бесконечных). */
export function lineIntersectionInfinite(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x4 = p4.x;
  const y4 = p4.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

function orient(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point2D, b: Point2D, p: Point2D, eps: number): boolean {
  return p.x >= Math.min(a.x, b.x) - eps && p.x <= Math.max(a.x, b.x) + eps &&
    p.y >= Math.min(a.y, b.y) - eps && p.y <= Math.max(a.y, b.y) + eps;
}

function segmentsIntersectProper(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D,
  eps: number
): boolean {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  if (o1 * o2 < -eps * eps && o3 * o4 < -eps * eps) return true;
  if (Math.abs(o1) < eps && onSegment(p1, p2, p3, eps)) return true;
  if (Math.abs(o2) < eps && onSegment(p1, p2, p4, eps)) return true;
  if (Math.abs(o3) < eps && onSegment(p3, p4, p1, eps)) return true;
  if (Math.abs(o4) < eps && onSegment(p3, p4, p2, eps)) return true;
  return false;
}

/** Проверка самопересечения простого замкнутого многоугольника. */
export function polygonSelfIntersects(points: Point2D[], eps: number = 1): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (i === j) continue;
      if ((i + 1) % n === j || (j + 1) % n === i) continue;
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersectProper(a1, a2, b1, b2, eps)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Смещение замкнутого многоугольника: delta > 0 — в сторону от центроида (наружу для CCW).
 */
export function offsetClosedPolygonOutward(pts: Point2D[], delta: number): Point2D[] {
  const n = pts.length;
  if (n < 3) return pts.map((p) => ({ ...p }));
  if (Math.abs(delta) < 1e-9) return pts.map((p) => ({ ...p }));

  const cx = pts.reduce((s, p) => s + p.x, 0) / n;
  const cy = pts.reduce((s, p) => s + p.y, 0) / n;

  const offsetLines: Array<{ p0: Point2D; p1: Point2D }> = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[i]!;
    const p1 = pts[(i + 1) % n]!;
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    const ex = p1.x - p0.x;
    const ey = p1.y - p0.y;
    const elen = Math.hypot(ex, ey) || 1e-9;
    let nx = -ey / elen;
    let ny = ex / elen;
    const dot = nx * (cx - mx) + ny * (cy - my);
    if (dot > 0) {
      nx = -nx;
      ny = -ny;
    }
    const p0o = { x: p0.x + nx * delta, y: p0.y + ny * delta };
    const p1o = { x: p1.x + nx * delta, y: p1.y + ny * delta };
    offsetLines.push({ p0: p0o, p1: p1o });
  }

  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const L0 = offsetLines[i]!;
    const L1 = offsetLines[(i + 1) % n]!;
    const inter = lineIntersectionInfinite(L0.p0, L0.p1, L1.p0, L1.p1);
    if (inter) {
      out.push(inter);
    } else {
      out.push({ ...L1.p0 });
    }
  }
  return out;
}

/** Внешнее кольцо SIP по наружным граням (d→c) для упорядоченных стен. */
export function buildOuterSipRing(orderedWalls: Wall[], tolMm: number = FOUNDATION_WALL_ENDPOINT_TOL_MM): Point2D[] {
  const n = orderedWalls.length;
  const verts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const w = orderedWalls[i]!;
    const [, , , d] = wallFootprintCorners(w);
    const prev = orderedWalls[(i + n - 1) % n]!;
    const [, , cPrev] = wallFootprintCorners(prev);
    if (dist(cPrev, d) <= tolMm) {
      verts.push({ x: (cPrev.x + d.x) / 2, y: (cPrev.y + d.y) / 2 });
    } else {
      verts.push({ ...d });
    }
  }
  return verts;
}

export interface FoundationBuildParams {
  outerOffsetMm: number;
  widthMm: number;
  innerOffsetExtraMm: number;
}

export function buildFoundationContours(
  orderedWalls: Wall[],
  params: FoundationBuildParams,
  tolMm: number = FOUNDATION_WALL_ENDPOINT_TOL_MM
):
  | { ok: true; sipOuter: Point2D[]; outer: Point2D[]; inner: Point2D[] }
  | { ok: false; reason: string } {
  const { outerOffsetMm, widthMm, innerOffsetExtraMm } = params;
  if (widthMm <= 0 || outerOffsetMm < 0 || innerOffsetExtraMm < 0) {
    return { ok: false, reason: 'Ширина и смещения должны быть положительными (кроме нулевого вынесения)' };
  }

  const sip = buildOuterSipRing(orderedWalls, tolMm);
  if (sip.length < 3) {
    return { ok: false, reason: 'Некорректный контур SIP' };
  }

  let sipCCW = sip;
  if (polygonAreaSigned(sip) < 0) {
    sipCCW = [...sip].reverse();
  }

  if (polygonSelfIntersects(sipCCW)) {
    return { ok: false, reason: 'Контур SIP самопересекается' };
  }

  const outer = offsetClosedPolygonOutward(sipCCW, outerOffsetMm);
  let inner = offsetClosedPolygonOutward(outer, -widthMm);
  if (innerOffsetExtraMm > 0) {
    inner = offsetClosedPolygonOutward(inner, -innerOffsetExtraMm);
  }

  if (polygonAreaSigned(inner) <= 0) {
    return { ok: false, reason: 'Внутренний контур фундамента вырожден — уменьшите ширину или смещения' };
  }

  return { ok: true, sipOuter: sipCCW, outer, inner };
}
