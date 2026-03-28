import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { normalizeArchitecturalSnapshotForCandidate } from './normalizeArchitecturalSnapshot.js';
import { buildBuildingModelCandidateFromReviewedSnapshot } from '../buildBuildingModelCandidate.js';
import type { ReviewedArchitecturalSnapshot } from '@2wix/shared-types';

/** Упрощённый «сложный» план: L-образный контур + внутренние перегородки (не прямоугольник из 4 стен). */
function complexHouseSnapshot(): ArchitecturalImportSnapshot {
  const floorId = 'floor-1';
  const outer: NonNullable<ArchitecturalImportSnapshot['outerContour']> = {
    kind: 'polygon',
    points: [
      { x: 0, y: 0 },
      { x: 14_000, y: 0 },
      { x: 14_000, y: 8000 },
      { x: 8000, y: 8000 },
      { x: 8000, y: 14_000 },
      { x: 0, y: 14_000 },
    ],
  };
  const walls: ArchitecturalImportSnapshot['walls'] = [];
  let wi = 0;
  const ext = (points: { x: number; y: number }[]) => {
    wi += 1;
    walls.push({ id: `ext-${wi}`, floorId, points, typeHint: 'external' as const, thicknessHintMm: 163 });
  };
  const intr = (points: { x: number; y: number }[]) => {
    wi += 1;
    walls.push({ id: `int-${wi}`, floorId, points, typeHint: 'internal' as const, thicknessHintMm: 114 });
  };
  ext([
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
  ]);
  ext([
    { x: 4000, y: 0 },
    { x: 8000, y: 0 },
  ]);
  ext([
    { x: 8000, y: 0 },
    { x: 14_000, y: 0 },
  ]);
  intr([
    { x: 4000, y: 2000 },
    { x: 4000, y: 6000 },
  ]);
  intr([
    { x: 4000, y: 4000 },
    { x: 8000, y: 4000 },
  ]);
  intr([
    { x: 8000, y: 4000 },
    { x: 8000, y: 8000 },
  ]);

  return {
    projectMeta: { name: 'L-fixture' },
    floors: [{ id: floorId, label: '1' }],
    outerContour: outer,
    walls,
    openings: [],
    stairs: [],
    roofHints: { likelyType: 'gabled', confidence: { score: 0.85, level: 'high' } },
    dimensions: [],
    unresolved: [],
    notes: [],
  };
}

describe('geometry pipeline integration (fixtures)', () => {
  it('сохраняет нетривиальную топологию: не сводится к footprint shell и даёт >4 сегментов', () => {
    const snap = complexHouseSnapshot();
    const r = normalizeArchitecturalSnapshotForCandidate(snap);
    expect(r.usedFootprintShell).toBe(false);
    expect(r.segmentsAfterFilterAndRefine).toBeGreaterThanOrEqual(6);
    expect(r.normalizationWallStrategy).not.toBe('footprint_shell');
    expect(r.geometryPipelineStages?.segmentsAfterShortFilter).toBeGreaterThan(0);
  });

  it('buildCandidate: кандидат наследует несколько стен и не включает крышу только из-за NO_VALID из normalize', () => {
    const snap = complexHouseSnapshot();
    const reviewed: ReviewedArchitecturalSnapshot = {
      baseSnapshot: snap,
      transformedSnapshot: snap,
      appliedDecisions: {},
      resolvedIssueIds: [],
      notes: [],
      generatedAt: '2026-03-28T00:00:00.000Z',
    };
    const c = buildBuildingModelCandidateFromReviewedSnapshot(reviewed, { importJobId: 'ij-fixture' });
    expect(c.model.walls.length).toBeGreaterThanOrEqual(6);
    expect(c.geometryDiagnostics?.usedFootprintShell).toBe(false);
    expect(c.geometryDiagnostics?.candidateWallCount).toBe(c.model.walls.length);
    expect(c.geometryDiagnostics?.roofIncluded).toBe(true);
  });
});
