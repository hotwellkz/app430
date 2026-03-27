import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot, ImportUserDecisionSet } from '@2wix/shared-types';
import { computeImportReviewReadiness } from './reviewReadiness';

function baseSnapshot(overrides?: Partial<ArchitecturalImportSnapshot>): ArchitecturalImportSnapshot {
  return {
    projectMeta: {},
    floors: [{ id: 'f1' }],
    walls: [],
    openings: [],
    stairs: [],
    unresolved: [],
    notes: [],
    ...overrides,
  };
}

describe('computeImportReviewReadiness', () => {
  it('requires floor heights for every floor', () => {
    const snap = baseSnapshot();
    const r = computeImportReviewReadiness(snap, {});
    expect(r.isReadyToApply).toBe(false);
    expect(r.missingRequiredDecisions.some((m) => m.code === 'FLOOR_HEIGHTS_REQUIRED')).toBe(true);
  });

  it('passes when all required decisions satisfied (no roof hints)', () => {
    const snap = baseSnapshot({
      unresolved: [],
    });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: false, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(true);
  });

  it('requires roof when roofHints present', () => {
    const snap = baseSnapshot({
      roofHints: { likelyType: 'gabled', confidence: { score: 0.9, level: 'high' } },
    });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: false, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(false);
    expect(r.missingRequiredDecisions.some((m) => m.code === 'ROOF_TYPE_CONFIRMATION_REQUIRED')).toBe(true);
  });

  it('requires wall ids when internal bearing confirmed true', () => {
    const snap = baseSnapshot({
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
          typeHint: 'internal',
        },
      ],
    });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: true, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(false);
    expect(r.missingRequiredDecisions.some((m) => m.code === 'INTERNAL_BEARING_WALL_IDS_REQUIRED')).toBe(true);
  });

  it('passes when internal bearing true and wall id selected', () => {
    const snap = baseSnapshot({
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
          typeHint: 'internal',
        },
      ],
    });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: true, wallIds: ['w1'] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(true);
  });

  it('fails when internal bearing true but no walls in snapshot', () => {
    const snap = baseSnapshot({ walls: [] });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: true, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(false);
    expect(
      r.missingRequiredDecisions.some((m) => m.code === 'INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE')
    ).toBe(true);
  });

  it('requires blocking issue resolutions', () => {
    const snap = baseSnapshot({
      unresolved: [
        { id: 'i1', code: 'X', severity: 'blocking', message: 'block' },
      ],
    });
    const d: ImportUserDecisionSet = {
      floorHeightsMmByFloorId: { f1: 2800 },
      internalBearingWalls: { confirmed: false, wallIds: [] },
      scale: { mode: 'confirmed', mmPerPixel: null },
      issueResolutions: [],
    };
    const r = computeImportReviewReadiness(snap, d);
    expect(r.isReadyToApply).toBe(false);
    expect(r.remainingBlockingIssueIds).toEqual(['i1']);
  });
});
