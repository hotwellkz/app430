import type { Opening, Point2D, Wall } from '@2wix/shared-types';
import { computeWallLengthMm } from './wallOps.js';
import { OPENING_EDGE_MARGIN_MM, OPENING_MIN_GAP_ALONG_MM } from './openingConstants.js';

/** Проекция точки на ось стены (от start); along — расстояние вдоль оси от start. */
export function projectWorldOntoWallAxis(
  world: Point2D,
  wall: Wall
): { along: number; perpDistance: number; wallLengthMm: number } {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return {
      along: 0,
      perpDistance: Math.hypot(world.x - wall.start.x, world.y - wall.start.y),
      wallLengthMm: 0,
    };
  }
  const ux = dx / len;
  const uy = dy / len;
  const relx = world.x - wall.start.x;
  const rely = world.y - wall.start.y;
  const along = relx * ux + rely * uy;
  const perp = Math.abs(relx * -uy + rely * ux);
  return { along, perpDistance: perp, wallLengthMm: len };
}

/** Интервал проёма вдоль стены [start, end] от точки start стены. */
export function computeOpeningSpanAlongWall(
  opening: Pick<Opening, 'positionAlongWall' | 'widthMm'>
): { start: number; end: number } {
  const h = opening.widthMm / 2;
  return { start: opening.positionAlongWall - h, end: opening.positionAlongWall + h };
}

/** true, если интервалы пересекаются или разделены меньше чем minGapMm. */
export function openingSpansTooClose(
  a: { start: number; end: number },
  b: { start: number; end: number },
  minGapMm: number
): boolean {
  if (a.end < b.start) return b.start - a.end < minGapMm;
  if (b.end < a.start) return a.start - b.end < minGapMm;
  return true;
}

/** Допустимый диапазон центра проёма вдоль стены с учётом ширины и отступа от краёв. */
export function openingCenterAllowedRange(
  widthMm: number,
  wallLengthMm: number,
  edgeMarginMm: number = OPENING_EDGE_MARGIN_MM
): { minCenter: number; maxCenter: number } | null {
  const half = widthMm / 2;
  const minCenter = half + edgeMarginMm;
  const maxCenter = wallLengthMm - half - edgeMarginMm;
  if (minCenter > maxCenter) return null;
  return { minCenter, maxCenter };
}

export function clampOpeningCenterAlongWall(
  centerAlong: number,
  widthMm: number,
  wallLengthMm: number,
  edgeMarginMm: number = OPENING_EDGE_MARGIN_MM
): number {
  const range = openingCenterAllowedRange(widthMm, wallLengthMm, edgeMarginMm);
  if (!range) return wallLengthMm / 2;
  return Math.max(range.minCenter, Math.min(range.maxCenter, centerAlong));
}

/** Четыре угла прямоугольника проёма в плоскости XY (вдоль стены × поперёк толщины). */
export function computeOpeningFootprintCorners(opening: Opening, wall: Wall): [Point2D, Point2D, Point2D, Point2D] {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    const p = wall.start;
    return [p, p, p, p];
  }
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const cx = wall.start.x + ux * opening.positionAlongWall;
  const cy = wall.start.y + uy * opening.positionAlongWall;
  const halfW = opening.widthMm / 2;
  const halfT = wall.thicknessMm * 0.42;
  /** du — смещение вдоль стены (мм), dp — поперёк (мм). */
  const corner = (du: number, dp: number): Point2D => ({
    x: cx + ux * du + px * dp,
    y: cy + uy * du + py * dp,
  });
  return [corner(-halfW, -halfT), corner(halfW, -halfT), corner(halfW, halfT), corner(-halfW, halfT)];
}

export function computeOpeningBoundsOnWall(
  opening: Opening,
  wall: Wall
): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = computeOpeningFootprintCorners(opening, wall);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function detectOpeningOutOfWallBounds(opening: Opening, wall: Wall): boolean {
  const len = computeWallLengthMm(wall);
  const range = openingCenterAllowedRange(opening.widthMm, len);
  if (!range) return true;
  return (
    opening.positionAlongWall < range.minCenter - 1e-6 ||
    opening.positionAlongWall > range.maxCenter + 1e-6
  );
}

export function detectOpeningTooCloseToWallEdge(opening: Opening, wall: Wall): boolean {
  return detectOpeningOutOfWallBounds(opening, wall);
}

export function detectOpeningOverlap(
  opening: Opening,
  modelOpeningsOnWall: Opening[],
  excludeOpeningId?: string,
  minGapMm?: number
): boolean {
  const gap = minGapMm ?? OPENING_MIN_GAP_ALONG_MM;
  const span = computeOpeningSpanAlongWall(opening);
  for (const o of modelOpeningsOnWall) {
    if (excludeOpeningId && o.id === excludeOpeningId) continue;
    if (openingSpansTooClose(span, computeOpeningSpanAlongWall(o), gap)) return true;
  }
  return false;
}

/** Центр проёма в мировых координатах XY (по оси стены). */
export function openingCenterWorldMm(
  opening: Pick<Opening, 'positionAlongWall'>,
  wall: Wall
): Point2D {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { ...wall.start };
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: wall.start.x + ux * opening.positionAlongWall,
    y: wall.start.y + uy * opening.positionAlongWall,
  };
}
