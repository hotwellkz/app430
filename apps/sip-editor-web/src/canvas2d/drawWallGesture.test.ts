import { describe, expect, it } from 'vitest';
import { drawWallCancel, drawWallOnPointerDown, drawWallOnPointerMove } from './drawWallGesture.js';

describe('drawWallGesture', () => {
  it('two clicks produce committed segment', () => {
    let s = drawWallCancel();
    const a = { x: 0, y: 0 };
    const b = { x: 3000, y: 4000 };
    const r1 = drawWallOnPointerDown(s, a);
    expect(r1.committed).toBeUndefined();
    expect(r1.next.kind).toBe('drawing');
    s = r1.next;
    const sMove = drawWallOnPointerMove(s, { x: 100, y: 0 });
    expect(sMove.kind).toBe('drawing');
    const r2 = drawWallOnPointerDown(sMove, b);
    expect(r2.committed).toEqual({ start: a, end: b });
    expect(r2.next.kind).toBe('idle');
  });
});
