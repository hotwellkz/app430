import { describe, expect, it } from 'vitest';
import {
  drawRectangleCancel,
  drawRectangleOnPointerDown,
  drawRectangleOnPointerMove,
} from './drawRectangleGesture.js';

describe('drawRectangleGesture', () => {
  it('два клика дают committed bbox', () => {
    let s = drawRectangleCancel();
    const a = drawRectangleOnPointerDown(s, { x: 0, y: 0 });
    expect(a.next.kind).toBe('drawing');
    s = a.next;
    const b = drawRectangleOnPointerDown(s, { x: 1000, y: 500 });
    expect(b.committed).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 500 });
    expect(b.next.kind).toBe('idle');
  });

  it('move обновляет cursor в режиме drawing', () => {
    let s = drawRectangleOnPointerDown({ kind: 'idle' }, { x: 100, y: 200 }).next;
    expect(s.kind).toBe('drawing');
    if (s.kind !== 'drawing') throw new Error('expected drawing');
    s = drawRectangleOnPointerMove(s, { x: 300, y: 400 });
    expect(s.kind).toBe('drawing');
    if (s.kind !== 'drawing') throw new Error('expected drawing');
    expect(s.cursor).toEqual({ x: 300, y: 400 });
  });
});
