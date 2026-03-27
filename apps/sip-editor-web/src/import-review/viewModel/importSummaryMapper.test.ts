import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import type { ImportJob } from '@2wix/shared-types';
import { IMPORT_SUMMARY_UI } from '../constants/labels';
import { compactWallIdsSummary, mapImportSummaryViewModel } from './importSummaryMapper';

function baseJob(over: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'ij-1',
    projectId: 'p1',
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u1',
    importSchemaVersion: 1,
    sourceImages: [],
    snapshot: {
      projectMeta: {},
      floors: [{ id: 'f1', label: 'Этаж 1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    errorMessage: null,
    ...over,
  };
}

describe('compactWallIdsSummary', () => {
  it('shows first 3 and rest count', () => {
    const r = compactWallIdsSummary(['a', 'b', 'c', 'd', 'e'], 3);
    expect(r.chips).toEqual(['a', 'b', 'c']);
    expect(r.more).toBe(2);
  });

  it('dedupes', () => {
    const r = compactWallIdsSummary(['x', 'x', 'y'], 3);
    expect(r.chips).toEqual(['x', 'y']);
    expect(r.more).toBe(0);
  });
});

describe('mapImportSummaryViewModel', () => {
  it('pipeline badges include extraction and review', () => {
    const vm = mapImportSummaryViewModel(
      baseJob({
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: false,
        },
      })
    );
    expect(vm.pipelineBadges.find((b) => b.key === 'extraction')).toBeTruthy();
    expect(vm.pipelineBadges.find((b) => b.key === 'review')?.text).toMatch(/Черновик/);
  });

  it('saved decisions: floor heights and internal bearing yes with chips', () => {
    const vm = mapImportSummaryViewModel(
      baseJob({
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: {
            floorHeightsMmByFloorId: { f1: 2800 },
            internalBearingWalls: { confirmed: true, wallIds: ['w1', 'w2', 'w3', 'w4'] },
            scale: { mode: 'confirmed', mmPerPixel: null },
          },
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
      })
    );
    const text = vm.savedDecisions.lines.join('\n');
    expect(text).toMatch(/2800/);
    expect(text).toMatch(/Внутренние несущие/);
    expect(text).toMatch(/\+1 ещё/);
  });

  it('candidate: hint when review not applied', () => {
    const vm = mapImportSummaryViewModel(
      baseJob({
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: false,
        },
      })
    );
    expect(vm.candidate.hint).toBe(IMPORT_SUMMARY_UI.hintReviewNotAppliedForCandidate);
    expect(vm.candidate.lines.length).toBe(0);
  });

  it('candidate: lines when review applied and candidate ready', () => {
    const model = createEmptyBuildingModel();
    model.floors = [{ id: 'fl1', label: 'F', elevationMm: 0, sortOrder: 0 }];
    model.walls = [{ id: 'wa1', floorId: 'fl1', label: 'W', thicknessMm: 100, points: [], heightMm: 3000 }];
    const vm = mapImportSummaryViewModel(
      baseJob({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        editorApply: {
          status: 'candidate_ready',
          generatedAt: '2026-01-01T00:00:00.000Z',
          generatedBy: 'u1',
          mapperVersion: 'm1',
          candidate: {
            model,
            warnings: [{ code: 'x', severity: 'warning', message: 'm', sourceType: 'wall', sourceId: 'w' }],
            trace: [{ sourceType: 'wall', sourceId: 'a', targetType: 'wall', targetId: 'b', rule: 'r' }],
            mapperVersion: 'mapper-v2',
            generatedAt: '2026-01-01T00:00:00.000Z',
            basedOnImportJobId: 'ij-1',
            basedOnReviewedSnapshotVersion: 'rs1',
            status: 'ready',
          },
        },
      })
    );
    expect(vm.candidate.hint).toBeNull();
    expect(vm.candidate.lines.some((l) => l.label === IMPORT_SUMMARY_UI.mapperVersionLabel)).toBe(true);
    expect(vm.candidate.lines.some((l) => l.value.includes('предупреждений 1'))).toBe(true);
  });

  it('project apply: lines when applied with summary', () => {
    const vm = mapImportSummaryViewModel(
      baseJob({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        projectApply: {
          status: 'applied',
          appliedVersionId: 'ver-long-id-here',
          appliedVersionNumber: 5,
          appliedAt: '2026-01-02T10:00:00.000Z',
          appliedBy: 'user-99',
          summary: {
            createdOrUpdatedVersionId: 'ver-long-id-here',
            appliedObjectCounts: { floors: 1, walls: 2, openings: 0, slabs: 0, roofs: 0 },
            warningsCount: 1,
            traceCount: 2,
            basedOnImportJobId: 'ij-1',
            basedOnMapperVersion: 'mv',
            basedOnReviewedSnapshotVersion: 'rs',
          },
          note: 'ok',
        },
      })
    );
    expect(vm.projectApply.hint).toBeNull();
    expect(vm.projectApply.lines.some((l) => l.label === IMPORT_SUMMARY_UI.noteLabel && l.value === 'ok')).toBe(true);
  });

  it('no undefined in labels when review missing', () => {
    const vm = mapImportSummaryViewModel(baseJob({ review: undefined }));
    expect(vm.savedDecisions.hint).toBe(IMPORT_SUMMARY_UI.hintNoReview);
    expect(JSON.stringify(vm)).not.toMatch(/undefined/);
  });
});
