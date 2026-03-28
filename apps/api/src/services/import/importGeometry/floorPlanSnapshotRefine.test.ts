import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { refineArchitecturalSnapshotGeometry } from './floorPlanSnapshotRefine.js';

describe('refineArchitecturalSnapshotGeometry', () => {
  it('snaps coordinates to grid and returns notes', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 1237, y: 8 },
          { x: 10003, y: 12 },
          { x: 10000, y: 10000 },
          { x: 0, y: 10002 },
        ],
      },
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 100, y: 200 },
            { x: 5103, y: 198 },
            { x: 5100, y: 5105 },
          ],
          typeHint: 'internal',
        },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    const { snapshot, notes } = refineArchitecturalSnapshotGeometry(snap, { gridMm: 10 });
    expect(notes.length).toBeGreaterThan(0);
    const p0 = snapshot.outerContour?.points?.[0];
    expect(p0).toBeDefined();
    expect((p0 as { x: number }).x % 10).toBe(0);
    expect(snapshot.walls[0]?.points?.length).toBeGreaterThanOrEqual(2);
  });
});
