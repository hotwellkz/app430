import type { Point2D } from '@2wix/shared-types';

export type DrawRectangleGestureState =
  | { kind: 'idle' }
  | { kind: 'drawing'; cornerA: Point2D; cursor: Point2D };

export type DrawRectangleClickResult = {
  next: DrawRectangleGestureState;
  /** Противоположные углы оси-выровненного прямоугольника (min/max по x и y). */
  committed?: { minX: number; minY: number; maxX: number; maxY: number };
};

/** Два клика: угол → противоположный угол (как «Стена»). */
export function drawRectangleOnPointerDown(
  state: DrawRectangleGestureState,
  currentWorld: Point2D
): DrawRectangleClickResult {
  if (state.kind === 'idle') {
    return {
      next: { kind: 'drawing', cornerA: currentWorld, cursor: currentWorld },
    };
  }
  const ax = state.cornerA.x;
  const ay = state.cornerA.y;
  const bx = currentWorld.x;
  const by = currentWorld.y;
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  return {
    next: { kind: 'idle' },
    committed: { minX, minY, maxX, maxY },
  };
}

export function drawRectangleOnPointerMove(
  state: DrawRectangleGestureState,
  cursorWorld: Point2D
): DrawRectangleGestureState {
  if (state.kind !== 'drawing') return state;
  return { ...state, cursor: cursorWorld };
}

export function drawRectangleCancel(): DrawRectangleGestureState {
  return { kind: 'idle' };
}
