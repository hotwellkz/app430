import type { Point2D } from '@2wix/shared-types';

export type DrawWallGestureState =
  | { kind: 'idle' }
  | { kind: 'drawing'; start: Point2D; cursor: Point2D };

export type DrawWallClickResult = {
  next: DrawWallGestureState;
  committed?: { start: Point2D; end: Point2D };
};

/**
 * Два клика: первый фиксирует начало, второй — конец (end берётся из currentWorld).
 * Пока ждём второй клик, cursor обновляется из pointermove.
 */
export function drawWallOnPointerDown(
  state: DrawWallGestureState,
  currentWorld: Point2D
): DrawWallClickResult {
  if (state.kind === 'idle') {
    return {
      next: { kind: 'drawing', start: currentWorld, cursor: currentWorld },
    };
  }
  return {
    next: { kind: 'idle' },
    committed: { start: state.start, end: currentWorld },
  };
}

export function drawWallOnPointerMove(
  state: DrawWallGestureState,
  cursorWorld: Point2D
): DrawWallGestureState {
  if (state.kind !== 'drawing') return state;
  return { ...state, cursor: cursorWorld };
}

export function drawWallCancel(): DrawWallGestureState {
  return { kind: 'idle' };
}
