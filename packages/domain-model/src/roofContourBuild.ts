import type { BuildingModel, Point2D, Wall } from '@2wix/shared-types';
import { isExternalWallForFoundation, orderExternalWallsInRing } from './foundationOuterWallLoop.js';
import { buildOuterSipRing, polygonAreaSigned, polygonSelfIntersects, offsetClosedPolygonOutward } from './foundationStripBuild.js';
import { getWallsByFloor } from './wallOps.js';

const MIN_ROOF_AREA_MM2 = 250_000;
const AXIS_EDGE_EPS_MM = 2;
const RECT_CORNER_EPS_MM = 25;

/**
 * Наружное кольцо SIP по наружным стенам этажа (для привязки крыши к «коробке»).
 */
export function buildOuterSipRingContourForRoof(
  model: BuildingModel,
  floorId: string
):
  | { ok: true; contourMm: Point2D[]; basedOnWallIds: string[] }
  | { ok: false; reason: string } {
  const floorWalls = getWallsByFloor(model, floorId);
  const external = floorWalls.filter((w) => isExternalWallForFoundation(w));
  if (external.length < 3) {
    return { ok: false, reason: 'Нужен замкнутый наружной контур стен для крыши' };
  }

  const ring = orderExternalWallsInRing(external);
  if (!ring.ok) {
    return { ok: false, reason: ring.reason };
  }

  const byId = new Map(floorWalls.map((w) => [w.id, w]));
  const ordered: Wall[] = ring.ids.map((id) => byId.get(id)).filter((w): w is Wall => Boolean(w));
  if (ordered.length !== ring.ids.length) {
    return { ok: false, reason: 'Не найдены стены контура крыши' };
  }

  const sip = buildOuterSipRing(ordered);
  if (sip.length < 3) {
    return { ok: false, reason: 'Некорректный контур SIP для крыши' };
  }

  let sipCCW = polygonAreaSigned(sip) < 0 ? [...sip].reverse() : sip;

  if (polygonSelfIntersects(sipCCW)) {
    return { ok: false, reason: 'Контур крыши самопересекается' };
  }

  const area = Math.abs(polygonAreaSigned(sipCCW));
  if (area < MIN_ROOF_AREA_MM2) {
    return { ok: false, reason: 'Площадь контура крыши слишком мала' };
  }

  return { ok: true, contourMm: sipCCW.map((p) => ({ ...p })), basedOnWallIds: [...ring.ids] };
}

function edgesAxisAlignedRectangle(pts: Point2D[], eps: number): boolean {
  const n = pts.length;
  if (n !== 4) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx > eps && dy > eps) return false;
  }
  return true;
}

/**
 * На этом шаге базовая крыша — только для ортогонального прямоугольника в плане.
 */
export function validateAxisAlignedRectangleContour(
  pts: Point2D[]
):
  | { ok: true; minX: number; maxX: number; minY: number; maxY: number }
  | { ok: false; reason: string } {
  if (pts.length !== 4) {
    return {
      ok: false,
      reason:
        'Невозможно построить базовую крышу по текущему контуру: нужен прямоугольный наружный контур (ровно четыре угла)',
    };
  }
  if (!edgesAxisAlignedRectangle(pts, AXIS_EDGE_EPS_MM)) {
    return {
      ok: false,
      reason:
        'Невозможно построить базовую крышу по текущему контуру: ось-ориентированный прямоугольник обязателен',
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 500 || h < 500) {
    return { ok: false, reason: 'Габариты контура крыши слишком малы' };
  }

  const area = Math.abs(polygonAreaSigned(pts));
  if (Math.abs(area - w * h) > RECT_CORNER_EPS_MM * Math.max(w, h)) {
    return {
      ok: false,
      reason: 'Невозможно построить базовую крышу по текущему контуру: ожидается прямоугольник',
    };
  }

  const corners: Point2D[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  for (const p of pts) {
    const near = corners.some((c) => Math.hypot(p.x - c.x, p.y - c.y) <= RECT_CORNER_EPS_MM * 4);
    if (!near) {
      return {
        ok: false,
        reason:
          'Невозможно построить базовую крышу по текущему контуру: вершины должны совпадать с углами прямоугольника',
      };
    }
  }

  return { ok: true, minX, maxX, minY, maxY };
}

export function buildEavesContourFromFootprint(footprint: Point2D[], overhangMm: number): Point2D[] {
  if (overhangMm <= 0) return footprint.map((p) => ({ ...p }));
  let ccw = polygonAreaSigned(footprint) < 0 ? [...footprint].reverse() : [...footprint];
  return offsetClosedPolygonOutward(ccw, overhangMm);
}
