import { describe, expect, it } from 'vitest';
import { canDeleteSelectedSpatial, isOpeningSelected, isWallSelected } from './selectionGuards.js';

describe('selectionGuards', () => {
  it('isWallSelected is true only for wall + id', () => {
    expect(isWallSelected({ selectedObjectType: 'wall', selectedObjectId: 'x' })).toBe(true);
    expect(isWallSelected({ selectedObjectType: 'floor', selectedObjectId: 'x' })).toBe(false);
    expect(isWallSelected({ selectedObjectType: 'wall', selectedObjectId: null })).toBe(false);
  });

  it('isOpeningSelected and canDeleteSelectedSpatial', () => {
    expect(isOpeningSelected({ selectedObjectType: 'opening', selectedObjectId: 'o1' })).toBe(true);
    expect(canDeleteSelectedSpatial({ selectedObjectType: 'opening', selectedObjectId: 'o1' })).toBe(true);
    expect(canDeleteSelectedSpatial({ selectedObjectType: 'floor', selectedObjectId: 'f1' })).toBe(false);
  });
});
