import type { Point2D, Roof } from '@2wix/shared-types';

const MM = 1 / 1000;

/** План: x,z в Three.js = domain (x,y). Высота = y в Three.js. */
function pushTri(
  out: number[],
  planX1: number,
  elev1: number,
  planY1: number,
  planX2: number,
  elev2: number,
  planY2: number,
  planX3: number,
  elev3: number,
  planY3: number
): void {
  out.push(
    planX1 * MM,
    elev1 * MM,
    planY1 * MM,
    planX2 * MM,
    elev2 * MM,
    planY2 * MM,
    planX3 * MM,
    elev3 * MM,
    planY3 * MM
  );
}

function boundsFromEaves(eaves: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of eaves) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Неиндексированные треугольники для BufferGeometry (позиции в метрах).
 * Возвращает null, если нет контура карниза.
 */
export function buildRoofSurfacePositionsMeters(roof: Roof): Float32Array | null {
  const eaves = roof.eavesContourMm;
  if (!eaves || eaves.length < 3) return null;
  const { minX, maxX, minY, maxY } = boundsFromEaves(eaves);
  const base = roof.baseElevationMm;
  const tan = Math.tan((roof.slopeDegrees * Math.PI) / 180);
  const t: number[] = [];

  if (roof.roofType === 'gable') {
    const rd = roof.ridgeDirection ?? 'x';
    if (rd === 'x') {
      const yMid = (minY + maxY) / 2;
      const run = (maxY - minY) / 2;
      const rise = tan * run;
      pushTri(t, minX, base, minY, maxX, base, minY, maxX, base + rise, yMid);
      pushTri(t, minX, base, minY, maxX, base + rise, yMid, minX, base + rise, yMid);
      pushTri(t, minX, base + rise, yMid, maxX, base + rise, yMid, maxX, base, maxY);
      pushTri(t, minX, base + rise, yMid, maxX, base, maxY, minX, base, maxY);
    } else {
      const xMid = (minX + maxX) / 2;
      const run = (maxX - minX) / 2;
      const rise = tan * run;
      pushTri(t, minX, base, minY, minX, base, maxY, xMid, base + rise, maxY);
      pushTri(t, minX, base, minY, xMid, base + rise, maxY, xMid, base + rise, minY);
      pushTri(t, xMid, base + rise, minY, xMid, base + rise, maxY, maxX, base, maxY);
      pushTri(t, xMid, base + rise, minY, maxX, base, maxY, maxX, base, minY);
    }
    return new Float32Array(t);
  }

  const rd = roof.ridgeDirection ?? 'x';
  const drain = roof.singleSlopeDrainToward ?? (rd === 'x' ? '+y' : '+x');
  const spanFull = rd === 'x' ? maxY - minY : maxX - minX;
  const rise = tan * spanFull;

  if (rd === 'x') {
    const yHi = drain === '+y' ? minY : maxY;
    const yLo = drain === '+y' ? maxY : minY;
    const eHi = drain === '+y' ? base + rise : base;
    const eLo = drain === '+y' ? base : base + rise;
    pushTri(t, minX, eHi, yHi, maxX, eHi, yHi, maxX, eLo, yLo);
    pushTri(t, minX, eHi, yHi, maxX, eLo, yLo, minX, eLo, yLo);
  } else {
    const xHi = drain === '+x' ? minX : maxX;
    const xLo = drain === '+x' ? maxX : minX;
    const eHi = drain === '+x' ? base + rise : base;
    const eLo = drain === '+x' ? base : base + rise;
    pushTri(t, xHi, eHi, minY, xHi, eHi, maxY, xLo, eLo, maxY);
    pushTri(t, xHi, eHi, minY, xLo, eLo, maxY, xLo, eLo, minY);
  }

  return new Float32Array(t);
}
