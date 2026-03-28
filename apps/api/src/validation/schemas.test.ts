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
  zDuplicateProjectBody,
  zPatchProjectBody,
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

  it('accepts optional isTemplate', () => {
    const r = zCreateProjectBody.safeParse({ createdBy: 'u1', isTemplate: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isTemplate).toBe(true);
  });
});

describe('zDuplicateProjectBody', () => {
  it('requires title and createdBy', () => {
    expect(zDuplicateProjectBody.safeParse({ createdBy: 'u1' }).success).toBe(false);
    expect(
      zDuplicateProjectBody.safeParse({ title: 'Копия', createdBy: 'u1' }).success
    ).toBe(true);
  });
});

describe('zPatchProjectBody', () => {
  it('requires updatedBy and at least one of title / isTemplate', () => {
    expect(zPatchProjectBody.safeParse({ updatedBy: 'u1' }).success).toBe(false);
    expect(zPatchProjectBody.safeParse({ updatedBy: 'u1', title: 'X' }).success).toBe(true);
    expect(zPatchProjectBody.safeParse({ updatedBy: 'u1', isTemplate: true }).success).toBe(true);
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
        base64Data: 'QQ==',
      }).success
    ).toBe(true);
  });

  it('accepts ImportAssetRef with firebase storage ref only', () => {
    expect(
      zImportAssetRef.safeParse({
        id: 'img-1',
        kind: 'plan',
        fileName: 'f.png',
        storageProvider: 'firebase',
        storagePath: 'sip-import-sources/p1/asset-id/f.png',
      }).success
    ).toBe(true);
  });

  it('rejects ImportAssetRef without base64 or firebase storage', () => {
    expect(
      zImportAssetRef.safeParse({
        id: 'img-1',
        kind: 'plan',
        fileName: 'f.png',
      }).success
    ).toBe(false);
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
        sourceImages: [{ id: 'img-1', kind: 'facade', fileName: 'f.png', base64Data: 'QQ==' }],
      }).success
    ).toBe(true);
  });

  it('accepts create import body with base64Data on assets', () => {
    expect(
      zCreateImportJobBody.safeParse({
        sourceImages: [
          {
            id: 'img-1',
            kind: 'plan',
            fileName: 'f.png',
            mimeType: 'image/png',
            base64Data: 'aGVsbG8=',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects empty sourceImages array', () => {
    expect(zCreateImportJobBody.safeParse({ sourceImages: [] }).success).toBe(false);
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
            mapperVersion: 'import-candidate-v2',
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
