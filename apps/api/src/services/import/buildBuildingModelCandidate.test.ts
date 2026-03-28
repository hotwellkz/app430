import { describe, expect, it } from 'vitest';
import {
  buildBuildingModelCandidateFromReviewedSnapshot,
  IMPORT_CANDIDATE_MAPPER_VERSION,
} from './buildBuildingModelCandidate.js';
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
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10_000, y: 0 },
          { x: 10_000, y: 10_000 },
          { x: 0, y: 10_000 },
        ],
        confidence: { score: 0.9, level: 'high' },
      },
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
      roofHints: { likelyType: 'gabled', confidence: { score: 0.85, level: 'high' } },
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
  it('maps floors, walls, openings and creates traces (v2 + diagnostics)', () => {
    const c = buildBuildingModelCandidateFromReviewedSnapshot(makeReviewed(), {
      importJobId: 'ij-1',
    });
    expect(c.mapperVersion).toBe(IMPORT_CANDIDATE_MAPPER_VERSION);
    expect(c.geometryDiagnostics?.pipelineVersion).toBe('import-geometry-v4');
    expect(c.geometryDiagnostics?.usedFootprintShell).toBe(false);
    expect(c.geometryDiagnostics?.normalizationWallStrategy).toBe('preserve_ai_walls');
    expect(c.geometryDiagnostics?.segmentsAfterFilterAndRefine).toBeGreaterThanOrEqual(1);
    expect(c.model.floors.length).toBeGreaterThan(0);
    expect(c.model.walls.length).toBeGreaterThanOrEqual(1);
    expect(c.model.walls[0]?.panelDirection).toMatch(/horizontal|vertical/);
    expect(c.model.openings.length).toBeGreaterThan(0);
    expect(c.trace.length).toBeGreaterThan(0);
    expect(c.status).toBe('partial');
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
    r.transformedSnapshot.openings = [];
    r.transformedSnapshot.outerContour = {
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 8000, y: 0 },
        { x: 8000, y: 8000 },
      ],
    };
    const c = buildBuildingModelCandidateFromReviewedSnapshot(r, { importJobId: 'ij-1' });
    expect(c.model.walls.length).toBeGreaterThan(0);
    expect(c.geometryDiagnostics?.usedFootprintShell).toBe(true);
    expect(c.geometryDiagnostics?.normalizationWallStrategy).toBe('footprint_shell');
    expect(c.model.roofs.length).toBe(0);
    expect(c.geometryDiagnostics?.roofIncluded).toBe(false);
    expect(c.geometryDiagnostics?.roofSuppressedReason).toBe('roof_deferred_footprint_shell_only');
  });

  it('inherits default panel library from empty building model (panel type not null)', () => {
    const c = buildBuildingModelCandidateFromReviewedSnapshot(makeReviewed(), { importJobId: 'ij-1' });
    expect(c.model.panelLibrary.length).toBeGreaterThan(0);
    expect(c.model.panelSettings.defaultPanelTypeId).toBeTruthy();
  });
});
