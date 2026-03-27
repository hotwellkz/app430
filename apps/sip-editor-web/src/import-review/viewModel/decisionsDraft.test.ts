import { describe, expect, it } from 'vitest';
import type { ArchitecturalImportSnapshot, ImportUserDecisionSet } from '@2wix/shared-types';
import { applyInternalBearingWallsInteraction } from './decisionsDraft';

function snap(): ArchitecturalImportSnapshot {
  return {
    projectMeta: {},
    floors: [{ id: 'f1' }],
    walls: [
      {
        id: 'w1',
        floorId: 'f1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        typeHint: 'internal',
      },
      {
        id: 'w2',
        floorId: 'f1',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        typeHint: 'internal',
      },
    ],
    openings: [],
    stairs: [],
    unresolved: [],
    notes: [],
  };
}

describe('applyInternalBearingWallsInteraction', () => {
  it('setMode no clears wallIds', () => {
    const prev: ImportUserDecisionSet = {
      internalBearingWalls: { confirmed: true, wallIds: ['w1'] },
    };
    const next = applyInternalBearingWallsInteraction(prev, snap(), { kind: 'setMode', mode: 'no' });
    expect(next.internalBearingWalls).toEqual({ confirmed: false, wallIds: [] });
  });

  it('setMode yes keeps only valid wall ids', () => {
    const prev: ImportUserDecisionSet = {
      internalBearingWalls: { confirmed: false, wallIds: [] },
    };
    const next = applyInternalBearingWallsInteraction(prev, snap(), { kind: 'setMode', mode: 'yes' });
    expect(next.internalBearingWalls).toEqual({ confirmed: true, wallIds: [] });
  });

  it('toggleWall adds and removes', () => {
    let d: ImportUserDecisionSet = {};
    d = applyInternalBearingWallsInteraction(d, snap(), { kind: 'setMode', mode: 'yes' });
    d = applyInternalBearingWallsInteraction(d, snap(), { kind: 'toggleWall', wallId: 'w1' });
    expect(d.internalBearingWalls?.wallIds).toEqual(['w1']);
    d = applyInternalBearingWallsInteraction(d, snap(), { kind: 'toggleWall', wallId: 'w1' });
    expect(d.internalBearingWalls?.wallIds).toEqual([]);
  });

  it('setMode unset removes internalBearingWalls', () => {
    const prev: ImportUserDecisionSet = {
      internalBearingWalls: { confirmed: true, wallIds: ['w1'] },
    };
    const next = applyInternalBearingWallsInteraction(prev, snap(), { kind: 'setMode', mode: '' });
    expect(next.internalBearingWalls).toBeUndefined();
  });
});
