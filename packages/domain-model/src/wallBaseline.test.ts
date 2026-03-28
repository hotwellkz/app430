import { describe, expect, it } from 'vitest';
import { baselineSegmentToCenterline, centerlineSegmentToBaseline } from './wallBaseline.js';

describe('wallBaseline', () => {
  const t = 200;

  it('roundtrips on-axis', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3000, y: 0 };
    const c = baselineSegmentToCenterline(a, b, t, 'on-axis');
    expect(c.start.x).toBeCloseTo(0);
    const back = centerlineSegmentToBaseline(c.start, c.end, t, 'on-axis');
    expect(back.start.x).toBeCloseTo(a.x);
    expect(back.end.x).toBeCloseTo(b.x);
  });

  it('inside/outside shift perpendicular to segment', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1000, y: 0 };
    const inside = baselineSegmentToCenterline(a, b, t, 'inside');
    expect(inside.start.y).toBeCloseTo(-t / 2);
    const outside = baselineSegmentToCenterline(a, b, t, 'outside');
    expect(outside.start.y).toBeCloseTo(t / 2);
  });
});
