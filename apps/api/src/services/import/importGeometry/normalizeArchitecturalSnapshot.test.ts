import { describe, expect, it } from 'vitest';
import { normalizeArchitecturalSnapshotForCandidate } from './normalizeArchitecturalSnapshot.js';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';

function baseSnap(): ArchitecturalImportSnapshot {
  return {
    projectMeta: { name: 'T' },
    floors: [{ id: 'f1', label: '1' }],
    walls: [],
    openings: [],
    stairs: [],
    unresolved: [],
    notes: [],
  };
}

describe('normalizeArchitecturalSnapshotForCandidate', () => {
  it('сохраняет сегменты AI, если после фильтра/refine осталась хотя бы одна стена', () => {
    const snap: ArchitecturalImportSnapshot = {
      ...baseSnap(),
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 12_000, y: 0 },
          { x: 12_000, y: 12_000 },
          { x: 0, y: 12_000 },
        ],
      },
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
          ],
          typeHint: 'external',
        },
      ],
      roofHints: { likelyType: 'gabled', confidence: { score: 0.9, level: 'high' } },
    };
    const r = normalizeArchitecturalSnapshotForCandidate(snap);
    expect(r.usedFootprintShell).toBe(false);
    expect(r.normalizationWallStrategy).toBe('preserve_ai_walls');
    expect(r.fallbacks).not.toContain('FOOTPRINT_SHELL_NO_AI_SEGMENTS');
    expect(r.segmentsAfterFilterAndRefine).toBeGreaterThanOrEqual(1);
    expect(r.snapshot.walls.length).toBeGreaterThanOrEqual(1);
    expect(r.allowParametricRoof).toBe(true);
  });

  it('строит оболочку по контуру только если нет ни одного сегмента стены', () => {
    const snap: ArchitecturalImportSnapshot = {
      ...baseSnap(),
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 12_000, y: 0 },
          { x: 12_000, y: 12_000 },
          { x: 0, y: 12_000 },
        ],
      },
      walls: [],
      roofHints: { likelyType: 'gabled', confidence: { score: 0.9, level: 'high' } },
    };
    const r = normalizeArchitecturalSnapshotForCandidate(snap);
    expect(r.usedFootprintShell).toBe(true);
    expect(r.normalizationWallStrategy).toBe('footprint_shell');
    expect(r.fallbacks).toContain('FOOTPRINT_SHELL_NO_AI_SEGMENTS');
    expect(r.snapshot.walls.length).toBeGreaterThanOrEqual(4);
  });

  it('откладывает крышу при единственной оболочке footprint shell (коробка без AI-стен)', () => {
    const snap: ArchitecturalImportSnapshot = {
      ...baseSnap(),
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 12_000, y: 0 },
          { x: 12_000, y: 12_000 },
          { x: 0, y: 12_000 },
        ],
      },
      walls: [],
      roofHints: { likelyType: 'gabled', confidence: { score: 0.9, level: 'high' } },
    };
    const r = normalizeArchitecturalSnapshotForCandidate(snap);
    expect(r.usedFootprintShell).toBe(true);
    expect(r.allowParametricRoof).toBe(false);
    expect(r.roofSuppressedReason).toBe('roof_deferred_footprint_shell_only');
    expect(r.geometryReasonCodes).toContain('ROOF_GATING_FOOTPRINT_SHELL_ONLY');
  });

  it('не строит крышу при слишком маленьком контуре', () => {
    const snap: ArchitecturalImportSnapshot = {
      ...baseSnap(),
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 0, y: 500 },
        ],
      },
      walls: [],
      roofHints: { likelyType: 'gabled', confidence: { score: 0.9, level: 'high' } },
    };
    const r = normalizeArchitecturalSnapshotForCandidate(snap);
    expect(r.allowParametricRoof).toBe(false);
    expect(r.roofSuppressedReason).toBe('footprint_too_small_for_roof');
  });
});
