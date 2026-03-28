import type { BuildingModel, Point2D } from '@2wix/shared-types';
import { getWallsByFloor } from './wallOps.js';

function projectParamOnSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { t: number; q: Point2D; dist: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) {
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    return { t: 0, q: { ...a }, dist };
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const q = { x: a.x + t * abx, y: a.y + t * aby };
  const dist = Math.hypot(p.x - q.x, p.y - q.y);
  return { t, q, dist };
}

/**
 * Snap для редактирования конца стены: узлы, концы других стен, внутренние точки осей (T-стык).
 */
export function snapPointForWallEndpointEdit(
  model: BuildingModel,
  floorId: string,
  p: Point2D,
  excludeWallId: string,
  thresholdMm: number = 280
): Point2D {
  let best = p;
  let bestD = thresholdMm;

  for (const j of model.wallJoints ?? []) {
    if (j.floorId !== floorId) continue;
    const d = Math.hypot(p.x - j.x, p.y - j.y);
    if (d < bestD) {
      bestD = d;
      best = { x: j.x, y: j.y };
    }
  }

  for (const w of getWallsByFloor(model, floorId)) {
    if (w.id === excludeWallId) continue;
    for (const j of [w.start, w.end]) {
      const d = Math.hypot(p.x - j.x, p.y - j.y);
      if (d < bestD) {
        bestD = d;
        best = { ...j };
      }
    }
    const pr = projectParamOnSegment(p, w.start, w.end);
    if (pr.t > 1e-5 && pr.t < 1 - 1e-5 && pr.dist < bestD) {
      bestD = pr.dist;
      best = pr.q;
    }
  }

  return best;
}
