import type { Point2D, Wall } from '@2wix/shared-types';

export function translateWallByDelta(wall: Wall, dx: number, dy: number): Wall {
  return {
    ...wall,
    start: { x: wall.start.x + dx, y: wall.start.y + dy },
    end: { x: wall.end.x + dx, y: wall.end.y + dy },
  };
}

export function wallMidpoint(wall: Wall): Point2D {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2,
  };
}
