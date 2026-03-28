/** 2D helpers for import footprint / walls (mm). */

export function distanceMm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Shoelace; points must be non-self-intersecting polygon. */
export function polygonAreaMm2(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    s += points[i]!.x * points[j]!.y - points[j]!.x * points[i]!.y;
  }
  return Math.abs(s) / 2;
}

export function boundingBoxMm(
  points: Array<{ x: number; y: number }>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = points[0]!.x;
  let maxY = points[0]!.y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function countWallSegmentsFromSnapshot(walls: Array<{ points: Array<{ x: number; y: number }> }>): number {
  let n = 0;
  for (const w of walls) {
    const pts = w.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    for (let i = 1; i < pts.length; i += 1) {
      if (distanceMm(pts[i - 1]!, pts[i]!) >= 1) n += 1;
    }
  }
  return n;
}

/** Сегменты по typeHint: internal vs всё остальное (external / не задано → несущий периметр). */
export function countWallSegmentsByTypeHint(walls: Array<{
  points: Array<{ x: number; y: number }>;
  typeHint?: 'external' | 'internal';
}>): { external: number; internal: number } {
  let external = 0;
  let internal = 0;
  for (const w of walls) {
    const pts = w.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const isInt = w.typeHint === 'internal';
    for (let i = 1; i < pts.length; i += 1) {
      if (distanceMm(pts[i - 1]!, pts[i]!) < 1) continue;
      if (isInt) internal += 1;
      else external += 1;
    }
  }
  return { external, internal };
}

/** Ray-casting; polygon closed by first-last edge. */
export function pointInPolygonMm(
  x: number,
  y: number,
  poly: Array<{ x: number; y: number }>
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const denom = yj - yi;
    const intersect =
      (yi > y) !== (yj > y) && denom !== 0 && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function filterWallPolylineShortSegments(
  points: Array<{ x: number; y: number }>,
  minSegmentMm: number
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;
  const out: Array<{ x: number; y: number }> = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    if (distanceMm(prev, cur) >= minSegmentMm) {
      out.push(cur);
    }
  }
  if (out.length >= 2 && distanceMm(out[out.length - 1]!, out[0]!) < minSegmentMm) {
    /* keep open polyline end */
  }
  return out.length >= 2 ? out : points;
}
