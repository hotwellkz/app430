import { describe, expect, it } from 'vitest';
import {
  zArchitecturalImportSnapshot,
  zCreateExportBody,
  zCreateImportJobBody,
  zCreateProjectBody,
  zPatchCurrentBody,
  zImportAssetRef,
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
  panelSettings: {
    defaultPanelTypeId: null,
    allowTrimmedPanels: true,
    minTrimWidthMm: 250,
    preferFullPanels: true,
    labelPrefixWall: 'W',
    labelPrefixRoof: 'R',
    labelPrefixSlab: 'S',
  },
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

describe('zCreateExportBody', () => {
  it('accepts supported formats', () => {
    expect(zCreateExportBody.safeParse({ createdBy: 'u1', format: 'pdf' }).success).toBe(true);
    expect(zCreateExportBody.safeParse({ createdBy: 'u1', format: 'csv' }).success).toBe(true);
    expect(zCreateExportBody.safeParse({ createdBy: 'u1', format: 'xlsx' }).success).toBe(true);
  });

  it('rejects unknown format', () => {
    expect(zCreateExportBody.safeParse({ createdBy: 'u1', format: 'docx' }).success).toBe(false);
  });

  it('accepts retryOfExportId', () => {
    expect(
      zCreateExportBody.safeParse({ createdBy: 'u1', format: 'pdf', retryOfExportId: 'exp-1' }).success
    ).toBe(true);
  });

  it('accepts presentationMode', () => {
    expect(
      zCreateExportBody.safeParse({
        createdBy: 'u1',
        format: 'pdf',
        presentationMode: 'commercial',
      }).success
    ).toBe(true);
  });
});

describe('import schemas', () => {
  it('accepts valid ImportAssetRef', () => {
    expect(
      zImportAssetRef.safeParse({
        id: 'img-1',
        kind: 'plan',
        fileName: 'plan.png',
        widthPx: 1920,
        heightPx: 1080,
      }).success
    ).toBe(true);
  });

  it('rejects invalid ImportAssetRef kind', () => {
    expect(
      zImportAssetRef.safeParse({
        id: 'img-1',
        kind: 'photo',
        fileName: 'plan.png',
      }).success
    ).toBe(false);
  });

  it('rejects invalid snapshot shape', () => {
    expect(
      zArchitecturalImportSnapshot.safeParse({
        projectMeta: {},
        floors: [{ id: 'f1' }],
        walls: [],
        openings: [],
        stairs: [],
        unresolved: [{ id: 'u1', code: 'X', severity: 'bad', message: 'oops' }],
        notes: [],
      }).success
    ).toBe(false);
  });

  it('accepts create import body', () => {
    expect(
      zCreateImportJobBody.safeParse({
        sourceImages: [{ id: 'img-1', kind: 'facade', fileName: 'f.png' }],
      }).success
    ).toBe(true);
  });
});
