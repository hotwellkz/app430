import type { Point2D, Wall } from '@2wix/shared-types';
import { endpointHandleRadiusWorldMm, hitToleranceWorldMm } from './viewMath.js';

/** Расстояние от точки до отрезка в мм. */
export function distancePointToSegmentMm(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

export function distancePointToWallCenterlineMm(p: Point2D, wall: Wall): number {
  return distancePointToSegmentMm(
    p.x,
    p.y,
    wall.start.x,
    wall.start.y,
    wall.end.x,
    wall.end.y
  );
}

/** Ближайшая стена к точке в пределах toleranceMm; при равенстве — с меньшим расстоянием. */
export function findClosestWallAtPoint(
  world: Point2D,
  walls: Wall[],
  toleranceMm: number
): Wall | null {
  let best: Wall | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const w of walls) {
    const d = distancePointToWallCenterlineMm(world, w);
    if (d <= toleranceMm && d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

export type WallEndpoint = 'start' | 'end';

export function hitWallEndpoint(
  world: Point2D,
  wall: Wall,
  radiusMm: number
): WallEndpoint | null {
  const ds = Math.hypot(world.x - wall.start.x, world.y - wall.start.y);
  const de = Math.hypot(world.x - wall.end.x, world.y - wall.end.y);
  if (ds <= radiusMm && ds <= de) return 'start';
  if (de <= radiusMm) return 'end';
  return null;
}

/** Клик по телу стены (перемещение целиком), не по ручкам концов. */
export function hitWallBodyForDrag(world: Point2D, wall: Wall, zoom: number): boolean {
  const handleR = endpointHandleRadiusWorldMm(zoom);
  const tol = hitToleranceWorldMm(zoom);
  const ds = Math.hypot(world.x - wall.start.x, world.y - wall.start.y);
  const de = Math.hypot(world.x - wall.end.x, world.y - wall.end.y);
  if (ds <= handleR || de <= handleR) return false;
  const dLine = distancePointToWallCenterlineMm(world, wall);
  return dLine <= tol;
}
