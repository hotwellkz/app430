import { describe, expect, it } from 'vitest';
import type { Wall } from '@2wix/shared-types';
import { proposeOpeningDragAlongWall } from './openingDrag.js';

describe('openingDrag', () => {
  it('clamps drag along wall and respects grid snap', () => {
    const wall: Wall = {
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 10000, y: 0 },
      thicknessMm: 200,
    };
    const along = proposeOpeningDragAlongWall({ x: 5123, y: 0 }, wall, 1200, 100, true);
    expect(along % 100).toBeLessThan(1e-6);
    expect(along).toBeGreaterThan(600);
    expect(along).toBeLessThan(9400);
  });
});
