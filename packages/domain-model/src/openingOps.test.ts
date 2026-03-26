import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addOpeningToModel,
  addWallToModel,
  createEmptyBuildingModel,
  createFloor,
  createOpening,
  createWall,
  deleteOpeningFromModel,
  updateOpeningInModel,
} from './index.js';

function modelWithFloorAndWall() {
  const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
  let m = addFloorToModel(createEmptyBuildingModel(), floor);
  const wall = createWall({
    id: 'w1',
    floorId: 'f1',
    start: { x: 0, y: 0 },
    end: { x: 8000, y: 0 },
    thicknessMm: 200,
  });
  const wr = addWallToModel(m, wall);
  if ('ok' in wr && wr.ok === false) throw new Error(wr.reason);
  return wr as typeof m;
}

describe('openingOps', () => {
  it('adds valid door opening', () => {
    const m = modelWithFloorAndWall();
    const o = createOpening({
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const r = addOpeningToModel(m, o);
    expect('openings' in (r as object)).toBe(true);
    const next = r as typeof m;
    expect(next.openings).toHaveLength(1);
  });

  it('rejects opening outside wall margins (too wide for short segment)', () => {
    const m = modelWithFloorAndWall();
    const o = createOpening({
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 9000,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const r = addOpeningToModel(m, o);
    expect('ok' in r && r.ok === false).toBe(true);
  });

  it('rejects overlapping openings on same wall', () => {
    const m0 = modelWithFloorAndWall();
    const a = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 3000,
      widthMm: 1000,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const m1 = addOpeningToModel(m0, a) as typeof m0;
    const b = createOpening({
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 3050,
      widthMm: 1000,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'window',
    });
    const r = addOpeningToModel(m1, b);
    expect('ok' in r && r.ok === false).toBe(true);
  });

  it('rejects door with non-zero bottom offset', () => {
    const m = modelWithFloorAndWall();
    const o = createOpening({
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 100,
      openingType: 'door',
    });
    const r = addOpeningToModel(m, o);
    expect('ok' in r && r.ok === false).toBe(true);
  });

  it('updateOpening excludes self from overlap check', () => {
    const m0 = modelWithFloorAndWall();
    const a = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const m1 = addOpeningToModel(m0, a) as typeof m0;
    const r = updateOpeningInModel(m1, 'o1', { positionAlongWall: 4100 });
    expect('openings' in (r as object)).toBe(true);
  });

  it('deleteOpeningFromModel removes opening', () => {
    const m0 = modelWithFloorAndWall();
    const a = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const m1 = addOpeningToModel(m0, a) as typeof m0;
    const m2 = deleteOpeningFromModel(m1, 'o1');
    expect(m2.openings).toHaveLength(0);
  });
});
