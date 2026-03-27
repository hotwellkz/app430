import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import {
  getInternalWallCandidatesFromSnapshot,
  polylineLengthPx,
} from './internalWallCandidates';

describe('internalWallCandidates', () => {
  it('prefers typeHint internal', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [
        { id: 'a', floorId: 'f1', points: [{ x: 0, y: 0 }], typeHint: 'external' },
        { id: 'b', floorId: 'f1', points: [{ x: 0, y: 0 }], typeHint: 'internal' },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    const c = getInternalWallCandidatesFromSnapshot(snap);
    expect(c.map((w) => w.id)).toEqual(['b']);
  });

  it('fallback: non-external when no internal', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [
        { id: 'a', floorId: 'f1', points: [{ x: 0, y: 0 }], typeHint: 'external' },
        { id: 'b', floorId: 'f1', points: [{ x: 0, y: 0 }] },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    const c = getInternalWallCandidatesFromSnapshot(snap);
    expect(c.map((w) => w.id)).toEqual(['b']);
  });

  it('polylineLengthPx sums segments', () => {
    expect(polylineLengthPx([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
  });
});
