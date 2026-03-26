import { describe, expect, it } from 'vitest';
import {
  zCreateProjectBody,
  zPatchCurrentBody,
  zCreateVersionBody,
} from './schemas.js';

const minimalModel = {
  meta: { id: 'm1', name: 'House' },
  settings: { units: 'mm', defaultWallThicknessMm: 200, gridStepMm: 100 },
  floors: [],
  walls: [],
  openings: [],
  slabs: [],
  roofs: [],
  panelLibrary: [],
  panelSettings: { defaultSupplier: null, toleranceMm: 2 },
};

describe('zCreateProjectBody', () => {
  it('requires createdBy', () => {
    expect(zCreateProjectBody.safeParse({}).success).toBe(false);
    expect(zCreateProjectBody.safeParse({ createdBy: 'u1' }).success).toBe(true);
  });
});

describe('zPatchCurrentBody', () => {
  it('accepts valid payload', () => {
    const r = zPatchCurrentBody.safeParse({
      buildingModel: minimalModel,
      updatedBy: 'u1',
      expectedCurrentVersionId: 'v1',
      expectedVersionNumber: 1,
      expectedSchemaVersion: 1,
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing buildingModel', () => {
    expect(
      zPatchCurrentBody.safeParse({
        updatedBy: 'u1',
        expectedCurrentVersionId: 'v1',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 1,
      }).success
    ).toBe(false);
  });
});

describe('zCreateVersionBody', () => {
  it('defaults mode', () => {
    const r = zCreateVersionBody.parse({ createdBy: 'u1' });
    expect(r.mode).toBe('clone-current');
  });
});
