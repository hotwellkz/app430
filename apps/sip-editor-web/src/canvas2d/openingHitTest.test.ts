import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '@2wix/shared-types';
import { findClosestOpeningAtPoint } from './openingHitTest.js';

describe('openingHitTest', () => {
  it('hits opening near wall centerline', () => {
    const wall: Wall = {
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    };
    const opening: Opening = {
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 2500,
      widthMm: 1000,
      heightMm: 2000,
      bottomOffsetMm: 0,
      openingType: 'window',
    };
    const map = new Map<string, Wall>([['w1', wall]]);
    const hit = findClosestOpeningAtPoint([opening], map, { x: 2500, y: 0 }, 80);
    expect(hit?.id).toBe('o1');
  });

  it('returns null far from opening', () => {
    const wall: Wall = {
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    };
    const opening: Opening = {
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 2500,
      widthMm: 1000,
      heightMm: 2000,
      bottomOffsetMm: 0,
      openingType: 'door',
    };
    const map = new Map<string, Wall>([['w1', wall]]);
    const hit = findClosestOpeningAtPoint([opening], map, { x: 2500, y: 500 }, 20);
    expect(hit).toBeNull();
  });
});
