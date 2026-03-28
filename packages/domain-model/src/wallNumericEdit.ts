import type { Point2D, Wall } from '@2wix/shared-types';

const RAD_TO_DEG = 180 / Math.PI;

/** Угол направления стены в градусах (atan2), диапазон (−180, 180]. */
export function wallDirectionDegrees(wall: Pick<Wall, 'start' | 'end'>): number {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  return Math.atan2(dy, dx) * RAD_TO_DEG;
}

/**
 * Новая точка end на той же оси от start с заданной длиной (мм), длина > 0.
 */
export function endPointForLengthFromStart(
  wall: Pick<Wall, 'start' | 'end'>,
  lengthMm: number
): Point2D | null {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || !Number.isFinite(lengthMm) || lengthMm <= 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  return { x: wall.start.x + ux * lengthMm, y: wall.start.y + uy * lengthMm };
}

export type TranslateAxis = 'x' | 'y' | 'both';

/** Сдвиг обоих концов стены; axis: только X, только Y или обе оси. */
export function translateWallEndpoints(
  wall: Pick<Wall, 'start' | 'end'>,
  dxMm: number,
  dyMm: number,
  axis: TranslateAxis = 'both'
): { start: Point2D; end: Point2D } {
  const rdx = axis === 'y' ? 0 : dxMm;
  const rdy = axis === 'x' ? 0 : dyMm;
  return {
    start: { x: wall.start.x + rdx, y: wall.start.y + rdy },
    end: { x: wall.end.x + rdx, y: wall.end.y + rdy },
  };
}

/**
 * Противоположный угол прямоугольника по заданным ширине/высоте и квадранту текущего курсора.
 */
export function rectangleOppositeCornerFromSize(
  cornerA: Point2D,
  currentCursor: Point2D,
  widthMm: number,
  heightMm: number
): Point2D | null {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return null;
  }
  const sx = currentCursor.x >= cornerA.x ? 1 : -1;
  const sy = currentCursor.y >= cornerA.y ? 1 : -1;
  return {
    x: cornerA.x + sx * widthMm,
    y: cornerA.y + sy * heightMm,
  };
}

/** Парсинг положительного числа мм из строки инпута. */
export function parsePositiveMmString(raw: string, minMm = 1): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const v = Number(t.replace(',', '.'));
  if (!Number.isFinite(v) || v < minMm) return null;
  return v;
}
