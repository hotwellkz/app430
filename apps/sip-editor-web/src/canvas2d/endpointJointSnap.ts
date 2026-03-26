import type { Point2D, Wall } from '@2wix/shared-types';

const DEFAULT_THRESHOLD_MM = 280;

/** Привязка конца стены к ближайшему узлу других стен (лёгкий joint-snap). */
export function snapPointToNearbyWallJoints(
  p: Point2D,
  walls: Wall[],
  excludeWallId: string,
  thresholdMm: number = DEFAULT_THRESHOLD_MM
): Point2D {
  let best: Point2D = p;
  let bestD = thresholdMm;
  for (const w of walls) {
    if (w.id === excludeWallId) continue;
    for (const j of [w.start, w.end]) {
      const d = Math.hypot(p.x - j.x, p.y - j.y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
  }
  return best;
}
