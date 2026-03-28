import { describe, expect, it } from 'vitest';
import {
  endPointForLengthFromStart,
  parsePositiveMmString,
  rectangleOppositeCornerFromSize,
  translateWallEndpoints,
  wallDirectionDegrees,
} from './wallNumericEdit.js';

describe('wallNumericEdit', () => {
  it('wallDirectionDegrees: горизонталь вправо ≈ 0°', () => {
    expect(
      wallDirectionDegrees({
        start: { x: 0, y: 0 },
        end: { x: 1000, y: 0 },
      })
    ).toBeCloseTo(0, 5);
  });

  it('endPointForLengthFromStart сохраняет направление', () => {
    const p = endPointForLengthFromStart(
      {
        start: { x: 0, y: 0 },
        end: { x: 1000, y: 0 },
      },
      2500
    );
    expect(p).toEqual({ x: 2500, y: 0 });
  });

  it('translateWallEndpoints: axis x только dx', () => {
    const g = translateWallEndpoints(
      { start: { x: 0, y: 1 }, end: { x: 10, y: 2 } },
      100,
      50,
      'x'
    );
    expect(g.start).toEqual({ x: 100, y: 1 });
    expect(g.end).toEqual({ x: 110, y: 2 });
  });

  it('rectangleOppositeCornerFromSize учитывает квадрант', () => {
    const c = rectangleOppositeCornerFromSize(
      { x: 0, y: 0 },
      { x: -100, y: -50 },
      7300,
      6095
    );
    expect(c).toEqual({ x: -7300, y: -6095 });
  });

  it('parsePositiveMmString отсекает мусор', () => {
    expect(parsePositiveMmString('')).toBeNull();
    expect(parsePositiveMmString('abc')).toBeNull();
    expect(parsePositiveMmString('7300')).toBe(7300);
    expect(parsePositiveMmString('2877,5')).toBe(2877.5);
  });
});
