import { describe, expect, it } from 'vitest';
import type { ImportJob, ImportUserDecisionSet } from '@2wix/shared-types';
import {
  mapImportJobToDetailViewModel,
  mapImportJobToListItemViewModel,
  shortJobId,
} from './importReviewMappers';

function jobBase(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'import-job-long-id-123',
    projectId: 'p1',
    status: 'needs_review',
    createdAt: '2026-03-27T10:00:00.000Z',
    updatedAt: '2026-03-27T10:00:00.000Z',
    createdBy: 'u1',
    importSchemaVersion: 1,
    sourceImages: [{ id: 'img', kind: 'plan', fileName: 'a.png' }],
    snapshot: {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    review: {
      status: 'draft',
      applyStatus: 'not_ready',
      decisions: {},
      missingRequiredDecisions: [],
      remainingBlockingIssueIds: [],
      isReadyToApply: false,
    },
    errorMessage: null,
    ...overrides,
  };
}

describe('shortJobId', () => {
  it('truncates long ids', () => {
    expect(shortJobId('abcdefghijklmnop')).toBe('abcdefgh…');
  });
});

describe('mapImportJobToListItemViewModel', () => {
  it('maps extraction and review labels', () => {
    const vm = mapImportJobToListItemViewModel(jobBase());
    expect(vm.extractionStatus).toBe('needs_review');
    expect(vm.reviewStatus).toBe('draft');
    expect(vm.createdAtLabel.length).toBeGreaterThan(4);
  });
});

describe('mapImportJobToDetailViewModel', () => {
  it('disables save/apply when review applied', () => {
    const j = jobBase({
      review: {
        status: 'applied',
        applyStatus: 'applied',
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed', mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        remainingBlockingIssueIds: [],
        isReadyToApply: true,
        reviewedSnapshot: null,
      },
    });
    const d: ImportUserDecisionSet = j.review!.decisions;
    const vm = mapImportJobToDetailViewModel(j, d);
    expect(vm.canSaveReview).toBe(false);
    expect(vm.canApplyReview).toBe(false);
    expect(vm.canPrepareCandidate).toBe(true);
  });

  it('enables apply only when local readiness complete', () => {
    const j = jobBase();
    const incomplete: ImportUserDecisionSet = {};
    const vmBad = mapImportJobToDetailViewModel(j, incomplete);
    expect(vmBad.canApplyReview).toBe(false);
    const complete: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: true, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const vmOk = mapImportJobToDetailViewModel(j, complete);
    expect(vmOk.canApplyReview).toBe(true);
  });

  it('enables apply candidate when editorApply ready', () => {
    const j = jobBase({
      review: {
        status: 'applied',
        applyStatus: 'applied',
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed', mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        remainingBlockingIssueIds: [],
        isReadyToApply: true,
        reviewedSnapshot: null,
      },
      editorApply: {
        status: 'candidate_ready',
        candidate: undefined,
        errorMessage: null,
        generatedAt: null,
        generatedBy: null,
        mapperVersion: null,
      },
    });
    const vm = mapImportJobToDetailViewModel(j, j.review!.decisions);
    expect(vm.canApplyCandidate).toBe(true);
  });

  it('builds required field keys for floors', () => {
    const j = jobBase();
    const vm = mapImportJobToDetailViewModel(j, {});
    const keys = vm.requiredFields.map((f) => f.key);
    expect(keys.some((k) => k.startsWith('floorHeight:'))).toBe(true);
    expect(keys).toContain('internalBearing');
    expect(keys).toContain('scaleMode');
  });
});
