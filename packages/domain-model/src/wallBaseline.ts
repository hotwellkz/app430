import type { Point2D, WallPlacementMode } from '@2wix/shared-types';

/**
 * Базовая линия (две точки клика) → центральная линии стены (start/end в модели).
 *
 * Соглашение: при обходе start→end вектор «внутрь здания» — слева (CCW контур).
 * - on-axis: базовая линия = центральная линия.
 * - inside: базовая линия = внутренняя грань (левая относительно хода start→end).
 * - outside: базовая линия = внешняя грань (правая).
 */
export function baselineSegmentToCenterline(
  start: Point2D,
  end: Point2D,
  thicknessMm: number,
  placement: WallPlacementMode
): { start: Point2D; end: Point2D } {
  if (placement === 'on-axis') {
    return { start: { ...start }, end: { ...end } };
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return { start: { ...start }, end: { ...end } };
  }
  const ux = dx / len;
  const uy = dy / len;
  const lx = -uy;
  const ly = ux;
  const half = thicknessMm / 2;
  let ox = 0;
  let oy = 0;
  if (placement === 'inside') {
    ox = -lx * half;
    oy = -ly * half;
  } else {
    ox = lx * half;
    oy = ly * half;
  }
  return {
    start: { x: start.x + ox, y: start.y + oy },
    end: { x: end.x + ox, y: end.y + oy },
  };
}

/** Обратное к baselineSegmentToCenterline: из центральной линии получить исходную базовую линию. */
export function centerlineSegmentToBaseline(
  start: Point2D,
  end: Point2D,
  thicknessMm: number,
  placement: WallPlacementMode
): { start: Point2D; end: Point2D } {
  if (placement === 'on-axis') {
    return { start: { ...start }, end: { ...end } };
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return { start: { ...start }, end: { ...end } };
  }
  const ux = dx / len;
  const uy = dy / len;
  const lx = -uy;
  const ly = ux;
  const half = thicknessMm / 2;
  let ox = 0;
  let oy = 0;
  if (placement === 'inside') {
    ox = lx * half;
    oy = ly * half;
  } else {
    ox = -lx * half;
    oy = -ly * half;
  }
  return {
    start: { x: start.x + ox, y: start.y + oy },
    end: { x: end.x + ox, y: end.y + oy },
  };
}
