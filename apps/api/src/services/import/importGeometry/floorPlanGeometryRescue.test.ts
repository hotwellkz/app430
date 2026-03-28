import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { countWallSegmentsByTypeHint, distanceMm } from './geom2d.js';
import { runGeometryRescuePass, snapWallAndContourEndpoints } from './floorPlanGeometryRescue.js';

describe('snapWallAndContourEndpoints', () => {
  it('merges nearby endpoints within tolerance', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
          typeHint: 'external',
        },
        {
          id: 'w2',
          floorId: 'f1',
          points: [
            { x: 1000, y: 0 },
            { x: 1000, y: 2000 },
          ],
          typeHint: 'external',
        },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    const out = snapWallAndContourEndpoints(snap, 80);
    const endW0 = out.walls[0]!.points![1]!;
    const startW1 = out.walls[1]!.points![0]!;
    expect(distanceMm(endW0, startW1)).toBeLessThan(1);
  });
});

describe('runGeometryRescuePass', () => {
  it('adds contour ring when only internal segments exist', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10_000, y: 0 },
          { x: 10_000, y: 8000 },
          { x: 0, y: 8000 },
        ],
      },
      walls: [
        {
          id: 'in1',
          floorId: 'f1',
          points: [
            { x: 5000, y: 0 },
            { x: 5000, y: 8000 },
          ],
          typeHint: 'internal',
        },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    const r = runGeometryRescuePass(snap, 'f1');
    expect(r.mixedContourSupplement).toBe(true);
    const split = countWallSegmentsByTypeHint(r.snapshot.walls ?? []);
    expect(split.external).toBeGreaterThanOrEqual(4);
    expect(split.internal).toBeGreaterThanOrEqual(1);
    expect(r.reasonCodes).toContain('MIXED_CONTOUR_RING_SUPPLEMENT_NO_EXTERNAL');
  });
});
