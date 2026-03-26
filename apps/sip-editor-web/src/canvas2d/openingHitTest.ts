import type { Opening, Point2D, Wall } from '@2wix/shared-types';
import { computeOpeningSpanAlongWall, projectWorldOntoWallAxis } from '@2wix/domain-model';

/** Ближайший проём под курсором (активный этаж). */
export function findClosestOpeningAtPoint(
  openings: Opening[],
  wallById: Map<string, Wall>,
  world: Point2D,
  tolMm: number
): Opening | null {
  let best: Opening | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const o of openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    const { along, perpDistance } = projectWorldOntoWallAxis(world, wall);
    const span = computeOpeningSpanAlongWall(o);
    const halfT = wall.thicknessMm / 2 + tolMm;
    if (perpDistance > halfT) continue;
    const alongPen =
      along < span.start ? span.start - along : along > span.end ? along - span.end : 0;
    if (alongPen > tolMm) continue;
    const d = perpDistance + alongPen;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
