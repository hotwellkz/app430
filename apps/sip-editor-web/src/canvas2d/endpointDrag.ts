import type { Point2D } from '@2wix/shared-types';
import type { Wall } from '@2wix/shared-types';
import type { WallEndpoint } from './hitTest.js';

export function wallWithEndpointMoved(
  wall: Wall,
  endpoint: WallEndpoint,
  world: Point2D
): Wall {
  if (endpoint === 'start') {
    return {
      ...wall,
      start: { x: world.x, y: world.y },
    };
  }
  return {
    ...wall,
    end: { x: world.x, y: world.y },
  };
}

export function updateWallPatchForEndpoint(
  endpoint: WallEndpoint,
  world: Point2D
): Partial<Pick<Wall, 'start' | 'end'>> {
  if (endpoint === 'start') {
    return { start: { x: world.x, y: world.y } };
  }
  return { end: { x: world.x, y: world.y } };
}
