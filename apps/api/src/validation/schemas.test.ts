import { describe, expect, it } from 'vitest';
import {
  zGetImportApplyHistoryResponse,
  zArchitecturalImportSnapshot,
  zApplyImportReviewBody,
  zApplyCandidateToProjectBody,
  zCreateExportBody,
  zCreateImportJobBody,
  zPrepareEditorApplyBody,
  zCreateProjectBody,
  zPatchCurrentBody,
  zImportAssetRef,
  zSaveImportReviewBody,
  zCreateVersionBody,
} from './schemas.js';
import { z } from 'zod';

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

  it('accepts valid review payload and partial payload', () => {
    expect(
      zSaveImportReviewBody.safeParse({
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          issueResolutions: [{ issueId: 'i1', action: 'confirm' }],
        },
      }).success
    ).toBe(true);
    expect(
      zSaveImportReviewBody.safeParse({
        updatedBy: 'u1',
        decisions: {
          roofTypeConfirmed: 'gabled',
        },
      }).success
    ).toBe(true);
  });

  it('rejects invalid review payload', () => {
    expect(
      zSaveImportReviewBody.safeParse({
        updatedBy: 'u1',
        decisions: {
          scale: { mode: 'override', mmPerPixel: -1 },
        },
      }).success
    ).toBe(false);
  });

  it('accepts valid apply request', () => {
    expect(
      zApplyImportReviewBody.safeParse({
        appliedBy: 'u1',
      }).success
    ).toBe(true);
  });

  it('accepts valid and rejects invalid prepare-editor-apply request', () => {
    expect(
      zPrepareEditorApplyBody.safeParse({
        generatedBy: 'u1',
      }).success
    ).toBe(true);
    expect(
      zPrepareEditorApplyBody.safeParse({
        generatedBy: '',
      }).success
    ).toBe(false);
  });

  it('accepts valid and rejects invalid apply-candidate request', () => {
    expect(
      zApplyCandidateToProjectBody.safeParse({
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v1',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      }).success
    ).toBe(true);
    expect(
      zApplyCandidateToProjectBody.safeParse({
        appliedBy: 'u1',
        expectedCurrentVersionId: '',
        expectedVersionNumber: 0,
        expectedSchemaVersion: 0,
      }).success
    ).toBe(false);
  });

  it('accepts valid import-apply-history response shape', () => {
    expect(
      zGetImportApplyHistoryResponse.safeParse({
        items: [
          {
            versionId: 'v1',
            versionNumber: 1,
            sourceKind: 'ai_import',
            importJobId: 'ij-1',
            mapperVersion: 'import-candidate-v1',
            reviewedSnapshotVersion: 'rev-1',
            appliedBy: 'u1',
            appliedAt: new Date().toISOString(),
            warningsCount: 0,
            traceCount: 10,
            note: null,
            isLegacy: true,
            isIncomplete: true,
            missingFields: ['reviewedSnapshotVersion'],
          },
        ],
      }).success
    ).toBe(true);
  });

  it('validates apply-candidate conflict error payload shape', () => {
    const zApplyCandidateConflictError = z.object({
      code: z.enum([
        'IMPORT_CANDIDATE_NOT_READY',
        'IMPORT_REVIEW_NOT_APPLIED',
        'IMPORT_APPLY_CONCURRENCY_CONFLICT',
        'IMPORT_CANDIDATE_MISSING',
      ]),
      message: z.string().min(1),
      status: z.literal(409),
      details: z
        .object({
          currentVersionId: z.string().min(1).optional(),
          currentVersionNumber: z.number().int().positive().optional(),
          currentSchemaVersion: z.number().int().positive().optional(),
        })
        .optional(),
      requestId: z.string().optional(),
    });
    expect(
      zApplyCandidateConflictError.safeParse({
        code: 'IMPORT_APPLY_CONCURRENCY_CONFLICT',
        message: 'Conflict',
        status: 409,
        details: {
          currentVersionId: 'v2',
          currentVersionNumber: 2,
          currentSchemaVersion: 2,
        },
      }).success
    ).toBe(true);
  });
});
