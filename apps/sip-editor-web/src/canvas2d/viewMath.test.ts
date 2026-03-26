import { describe, expect, it } from 'vitest';
import {
  clientToSvgPoint,
  hitToleranceWorldMm,
  panToKeepWorldUnderScreenPoint,
  screenToWorld,
  snapPointToGrid,
  worldToScreen,
} from './viewMath.js';

describe('viewMath', () => {
  it('worldToScreen / screenToWorld round-trip', () => {
    const panX = 100;
    const panY = 50;
    const zoom = 0.5;
    const w = { x: 2000, y: -1500 };
    const s = worldToScreen(w.x, w.y, panX, panY, zoom);
    const back = screenToWorld(s.x, s.y, panX, panY, zoom);
    expect(back.x).toBeCloseTo(w.x, 5);
    expect(back.y).toBeCloseTo(w.y, 5);
  });

  it('snapPointToGrid respects toggle', () => {
    const p = { x: 123, y: 456 };
    expect(snapPointToGrid(p, 100, false)).toEqual(p);
    expect(snapPointToGrid(p, 100, true)).toEqual({ x: 100, y: 500 });
  });

  it('hitToleranceWorldMm scales with zoom', () => {
    expect(hitToleranceWorldMm(1, 10)).toBe(10);
    expect(hitToleranceWorldMm(2, 10)).toBe(5);
  });

  it('panToKeepWorldUnderScreenPoint keeps cursor world fixed', () => {
    const panX = 0;
    const panY = 0;
    const z0 = 1;
    const z1 = 2;
    const sx = 400;
    const sy = 300;
    const { panX: p1x, panY: p1y } = panToKeepWorldUnderScreenPoint(sx, sy, panX, panY, z0, z1);
    const w0 = screenToWorld(sx, sy, panX, panY, z0);
    const w1 = screenToWorld(sx, sy, p1x, p1y, z1);
    expect(w1.x).toBeCloseTo(w0.x, 5);
    expect(w1.y).toBeCloseTo(w0.y, 5);
  });

  it('clientToSvgPoint offsets by bounding rect', () => {
    const svg = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }),
    } as SVGSVGElement;
    const p = clientToSvgPoint(50, 80, svg);
    expect(p).toEqual({ x: 40, y: 60 });
  });
});
