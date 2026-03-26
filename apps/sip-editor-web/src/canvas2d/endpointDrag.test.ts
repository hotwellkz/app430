import { describe, expect, it } from 'vitest';
import type { Wall } from '@2wix/shared-types';
import { updateWallPatchForEndpoint, wallWithEndpointMoved } from './endpointDrag.js';

const wall: Wall = {
  id: 'w',
  floorId: 'f',
  start: { x: 0, y: 0 },
  end: { x: 1000, y: 0 },
  thicknessMm: 200,
};

describe('endpointDrag', () => {
  it('wallWithEndpointMoved updates single endpoint', () => {
    const n = wallWithEndpointMoved(wall, 'end', { x: 2000, y: 500 });
    expect(n.end).toEqual({ x: 2000, y: 500 });
    expect(n.start).toEqual(wall.start);
  });

  it('updateWallPatchForEndpoint matches domain patch shape', () => {
    expect(updateWallPatchForEndpoint('start', { x: 1, y: 2 })).toEqual({
      start: { x: 1, y: 2 },
    });
  });
});
