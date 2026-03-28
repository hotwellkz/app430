import type { Point2D, Wall } from '@2wix/shared-types';
import { FOUNDATION_WALL_ENDPOINT_TOL_MM } from './foundationConstants.js';

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wallsShareEndpoint(a: Wall, b: Wall, tolMm: number = FOUNDATION_WALL_ENDPOINT_TOL_MM): boolean {
  const pairs: [Point2D, Point2D][] = [
    [a.start, b.start],
    [a.start, b.end],
    [a.end, b.start],
    [a.end, b.end],
  ];
  return pairs.some(([p, q]) => dist(p, q) <= tolMm);
}

/** Наружная стена: явно external или тип не задан (по умолчанию в редакторе — наружная). */
export function isExternalWallForFoundation(w: Wall): boolean {
  return w.wallType === 'external' || w.wallType === undefined;
}

/**
 * Упорядочивает наружные стены этажа в один замкнутый контур.
 * Каждая стена должна иметь ровно двух соседей по стыкам.
 */
export function orderExternalWallsInRing(
  walls: Wall[],
  tolMm: number = FOUNDATION_WALL_ENDPOINT_TOL_MM
): { ok: true; ids: string[] } | { ok: false; reason: string } {
  if (walls.length < 3) {
    return { ok: false, reason: 'Для контура нужно минимум три наружные стены' };
  }

  const neighbors = new Map<string, string[]>();
  for (const w of walls) {
    neighbors.set(w.id, []);
  }

  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i]!;
      const b = walls[j]!;
      if (wallsShareEndpoint(a, b, tolMm)) {
        neighbors.get(a.id)!.push(b.id);
        neighbors.get(b.id)!.push(a.id);
      }
    }
  }

  for (const w of walls) {
    const n = neighbors.get(w.id)!;
    if (n.length !== 2) {
      return {
        ok: false,
        reason:
          'Наружные стены не образуют один замкнутый контур: проверьте стыки и отсутствие «висячих» сегментов',
      };
    }
  }

  const start = walls[0]!;
  const order: string[] = [];
  let prev = '';
  let cur = start.id;

  for (let k = 0; k < walls.length; k += 1) {
    order.push(cur);
    const nbrs = neighbors.get(cur)!;
    const next = nbrs.find((n) => n !== prev);
    if (next === undefined) {
      return { ok: false, reason: 'Не удалось обойти контур по стыкам' };
    }
    prev = cur;
    cur = next;
  }

  if (cur !== start.id) {
    return { ok: false, reason: 'Контур наружных стен не замкнут' };
  }

  return { ok: true, ids: order };
}
