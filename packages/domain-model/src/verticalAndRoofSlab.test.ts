import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addRoofToModel,
  addSlabToModel,
  collectVerticalWarnings,
  createEmptyBuildingModel,
  createFloor,
  createRoof,
  createSlab,
  createWall,
  getEffectiveWallHeight,
  updateRoofInModel,
  updateSlabInModel,
  validateRoof,
  validateSlab,
} from './index.js';

describe('vertical model + slabs + roof', () => {
  it('effective wall height inherits from floor when wall height absent', () => {
    const floor = createFloor({ id: 'f1', heightMm: 3000, sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    expect(getEffectiveWallHeight(wall, floor)).toBe(3000);
  });

  it('effective wall height uses explicit override', () => {
    const floor = createFloor({ id: 'f1', heightMm: 2800, sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
      heightMm: 3500,
    });
    expect(getEffectiveWallHeight(wall, floor)).toBe(3500);
  });

  it('collects elevation mismatch warning', () => {
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, createFloor({ id: 'f1', level: 1, elevationMm: 0, heightMm: 2800, sortIndex: 0 }));
    m = addFloorToModel(m, createFloor({ id: 'f2', level: 2, elevationMm: 2600, heightMm: 2800, sortIndex: 1 }));
    const warnings = collectVerticalWarnings(m);
    expect(warnings.some((w) => w.code === 'FLOOR_ELEVATION_MISMATCH')).toBe(true);
  });

  it('create/update/delete slab workflow', () => {
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, createFloor({ id: 'f1', sortIndex: 0 }));
    m = { ...m, walls: [createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thicknessMm: 200 })] };
    const slab = createSlab({ floorId: 'f1', contourWallIds: ['w1'] });
    expect(validateSlab(slab, m).ok).toBe(true);
    const add = addSlabToModel(m, slab);
    expect(add.ok).toBe(true);
    if (!add.ok) return;
    const upd = updateSlabInModel(add.model, slab.id, { direction: 'y' });
    expect(upd.ok).toBe(true);
    if (!upd.ok) return;
    const delModel = { ...upd.model, slabs: upd.model.slabs.filter((s) => s.id !== slab.id) };
    expect(delModel.slabs).toHaveLength(0);
  });

  it('create/update/delete roof workflow + invalid slope', () => {
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, createFloor({ id: 'f1', sortIndex: 0 }));
    const roof = createRoof({ floorId: 'f1', baseElevationMm: 2800 });
    expect(validateRoof(roof, m).ok).toBe(true);
    const add = addRoofToModel(m, roof);
    expect(add.ok).toBe(true);
    if (!add.ok) return;
    const upd = updateRoofInModel(add.model, roof.id, { slopeDegrees: 32 });
    expect(upd.ok).toBe(true);
    expect(validateRoof({ ...roof, slopeDegrees: 0 }, m).ok).toBe(false);
    const delModel = { ...add.model, roofs: [] };
    expect(delModel.roofs).toHaveLength(0);
  });
});
