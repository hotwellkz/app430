import { describe, expect, it } from 'vitest';
import type { Wall } from '@2wix/shared-types';
import { computeFitViewTransform, computeWallsBoundingBoxMm } from './viewFit.js';

describe('viewFit', () => {
  it('computeWallsBoundingBoxMm returns null for empty', () => {
    expect(computeWallsBoundingBoxMm([])).toBeNull();
  });

  it('computeFitViewTransform centers bbox in viewport', () => {
    const wall: Wall = {
      id: 'w',
      floorId: 'f',
      start: { x: 0, y: 0 },
      end: { x: 2000, y: 0 },
      thicknessMm: 200,
    };
    const bb = computeWallsBoundingBoxMm([wall]);
    expect(bb).not.toBeNull();
    const t = computeFitViewTransform(bb!, 800, 600, 0);
    expect(t.zoom).toBeGreaterThan(0);
    const cx = (bb!.minX + bb!.maxX) / 2;
    const cy = (bb!.minY + bb!.maxY) / 2;
    expect(Math.abs(400 - (cx * t.zoom + t.panX))).toBeLessThan(1);
    expect(Math.abs(300 - (cy * t.zoom + t.panY))).toBeLessThan(1);
  });
});
