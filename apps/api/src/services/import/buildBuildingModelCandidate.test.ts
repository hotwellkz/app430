import { describe, expect, it } from 'vitest';
import { buildBuildingModelCandidateFromReviewedSnapshot } from './buildBuildingModelCandidate.js';
import type { ReviewedArchitecturalSnapshot } from '@2wix/shared-types';

function makeReviewed(): ReviewedArchitecturalSnapshot {
  return {
    baseSnapshot: {
      projectMeta: { name: 'House' },
      floors: [{ id: 'f1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    transformedSnapshot: {
      projectMeta: { name: 'House' },
      floors: [
        { id: 'f1', label: 'Floor 1', elevationHintMm: 0 },
        { id: 'f2', label: 'Floor 2', elevationHintMm: 3000 },
      ],
      walls: [
        {
          id: 'sw1',
          floorId: 'f1',
          points: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
          ],
          typeHint: 'external',
          thicknessHintMm: 163,
        },
      ],
      openings: [
        {
          id: 'op1',
          floorId: 'f1',
          wallId: 'sw1',
          type: 'door',
          positionAlongWallMm: 1000,
          widthMm: 900,
          heightMm: 2100,
        },
      ],
      stairs: [{ id: 'st1', floorId: 'f1' }],
      roofHints: { likelyType: 'gabled' },
      unresolved: [{ id: 'u1', code: 'X', severity: 'warning', message: 'warn' }],
      notes: [],
    },
    appliedDecisions: {},
    resolvedIssueIds: [],
    notes: [],
    generatedAt: '2026-03-26T00:00:00.000Z',
  };
}

describe('buildBuildingModelCandidateFromReviewedSnapshot', () => {
  it('maps floors, walls, openings and creates traces', () => {
    const c = buildBuildingModelCandidateFromReviewedSnapshot(makeReviewed(), {
      importJobId: 'ij-1',
    });
    expect(c.model.floors.length).toBeGreaterThan(0);
    expect(c.model.walls.length).toBeGreaterThan(0);
    expect(c.model.openings.length).toBeGreaterThan(0);
    expect(c.trace.length).toBeGreaterThan(0);
  });

  it('creates warning for unsupported stairs without crashing', () => {
    const c = buildBuildingModelCandidateFromReviewedSnapshot(makeReviewed(), {
      importJobId: 'ij-1',
    });
    expect(c.warnings.some((w) => w.code === 'STAIR_NOT_MAPPED_YET')).toBe(true);
  });

  it('falls back to contour walls when direct walls absent', () => {
    const r = makeReviewed();
    r.transformedSnapshot.walls = [];
    r.transformedSnapshot.outerContour = {
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
      ],
    };
    const c = buildBuildingModelCandidateFromReviewedSnapshot(r, { importJobId: 'ij-1' });
    expect(c.model.walls.length).toBeGreaterThan(0);
  });
});
