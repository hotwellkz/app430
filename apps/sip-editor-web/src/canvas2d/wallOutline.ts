import type { Point2D, Wall } from '@2wix/shared-types';

/** Четыре угла полосы стены вдоль центральной линии (мм). */
export function wallFootprintCorners(wall: Wall): [Point2D, Point2D, Point2D, Point2D] {
  const { start, end, thicknessMm } = wall;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const half = thicknessMm / 2;
  if (len < 1e-9) {
    return [start, end, end, start];
  }
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * half;
  const py = ux * half;
  const a: Point2D = { x: start.x + px, y: start.y + py };
  const b: Point2D = { x: end.x + px, y: end.y + py };
  const c: Point2D = { x: end.x - px, y: end.y - py };
  const d: Point2D = { x: start.x - px, y: start.y - py };
  return [a, b, c, d];
}

export function wallPolygonPointsMm(wall: Wall): string {
  const [a, b, c, d] = wallFootprintCorners(wall);
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
}
