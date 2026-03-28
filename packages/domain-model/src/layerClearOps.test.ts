import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addRoofToModel,
  addSlabToModel,
  buildFoundationAndScreedForFloor,
  createEmptyBuildingModel,
  upsertFoundationInModel,
  createFloor,
  createRoof,
  createSlab,
  createWall,
} from './index.js';
import {
  clearFoundationsAndScreeds,
  clearOpeningsForFloor,
  clearRoofs,
  clearSlabs,
  clearWallsForFloor,
} from './layerClearOps.js';

describe('layerClearOps', () => {
  it('clearWallsForFloor removes only walls on that floor', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    const f2 = createFloor({ label: '2', level: 2, elevationMm: 3000, sortIndex: 1 });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, f1);
    m = addFloorToModel(m, f2);
    const w1 = createWall({
      floorId: f1.id,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    const w2 = createWall({
      floorId: f2.id,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    m = { ...m, walls: [w1, w2] };
    const cleared = clearWallsForFloor(m, f1.id);
    expect(cleared.walls.map((w) => w.id)).toEqual([w2.id]);
    expect(cleared.openings).toEqual([]);
  });

  it('clearOpeningsForFloor removes only openings on floor', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, f1);
    const w = createWall({
      floorId: f1.id,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    m = { ...m, walls: [w] };
    m = {
      ...m,
      openings: [
        {
          id: 'o1',
          wallId: w.id,
          floorId: f1.id,
          positionAlongWall: 0.3,
          widthMm: 900,
          heightMm: 2100,
          openingType: 'door',
          bottomOffsetMm: 0,
        },
      ],
    };
    const cleared = clearOpeningsForFloor(m, f1.id);
    expect(cleared.openings).toEqual([]);
    expect(cleared.walls).toHaveLength(1);
  });

  it('clearFoundationsAndScreeds clears foundations and ground screeds', () => {
    const floor = createFloor({
      label: '1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, floor);
    const t = 200;
    const s = 6000;
    m.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: s, y: 0 },
        thicknessMm: t,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: s, y: 0 },
        end: { x: s, y: s },
        thicknessMm: t,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: s, y: s },
        end: { x: 0, y: s },
        thicknessMm: t,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 0, y: s },
        end: { x: 0, y: 0 },
        thicknessMm: t,
        wallType: 'external',
      })
    );
    const built = buildFoundationAndScreedForFloor(m, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    m = upsertFoundationInModel(m, built.foundation, built.screed);
    expect((m.foundations ?? []).length).toBeGreaterThan(0);
    const cleared = clearFoundationsAndScreeds(m);
    expect(cleared.foundations).toEqual([]);
    expect(cleared.groundScreeds).toEqual([]);
  });

  it('clearSlabs removes only slabs', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, f1);
    const slab = createSlab({ floorId: f1.id, slabType: 'interfloor', contourWallIds: [], thicknessMm: 200 });
    const ar = addSlabToModel(m, slab);
    expect(ar.ok).toBe(true);
    if (!ar.ok) return;
    m = ar.model;
    const cleared = clearSlabs(m);
    expect(cleared.slabs).toEqual([]);
  });

  it('clearRoofs removes only roofs', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, f1);
    const roof = createRoof({
      floorId: f1.id,
      roofType: 'gable',
      slopeDegrees: 30,
    });
    const ar = addRoofToModel(m, roof);
    expect(ar.ok).toBe(true);
    if (!ar.ok) return;
    m = ar.model;
    const cleared = clearRoofs(m);
    expect(cleared.roofs).toEqual([]);
  });
});
