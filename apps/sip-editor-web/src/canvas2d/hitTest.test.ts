import { describe, expect, it } from 'vitest';
import type { Wall } from '@2wix/shared-types';
import {
  distancePointToSegmentMm,
  findClosestWallAtPoint,
  hitWallEndpoint,
} from './hitTest.js';

const wall: Wall = {
  id: 'w',
  floorId: 'f',
  start: { x: 0, y: 0 },
  end: { x: 1000, y: 0 },
  thicknessMm: 200,
};

describe('hitTest', () => {
  it('distancePointToSegmentMm to horizontal segment', () => {
    expect(distancePointToSegmentMm(500, 50, 0, 0, 1000, 0)).toBe(50);
    expect(distancePointToSegmentMm(-100, 0, 0, 0, 1000, 0)).toBe(100);
  });

  it('findClosestWallAtPoint respects tolerance', () => {
    const walls = [wall];
    expect(findClosestWallAtPoint({ x: 500, y: 5 }, walls, 20)).not.toBeNull();
    expect(findClosestWallAtPoint({ x: 500, y: 200 }, walls, 20)).toBeNull();
  });

  it('hitWallEndpoint picks nearer handle', () => {
    expect(hitWallEndpoint({ x: 0, y: 0 }, wall, 100)).toBe('start');
    expect(hitWallEndpoint({ x: 1000, y: 0 }, wall, 100)).toBe('end');
    expect(hitWallEndpoint({ x: 500, y: 500 }, wall, 50)).toBeNull();
  });
});
