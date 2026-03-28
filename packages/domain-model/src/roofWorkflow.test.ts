import { describe, expect, it } from 'vitest';
import {
  buildRoofAssemblyForFloor,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  normalizeBuildingModel,
  recomputeRoofById,
  syncRoofStaleFromSignatures,
  translateWallEndpoints,
  updateWallInModel,
} from './index.js';

function rectangleFloorModel() {
  const model = createEmptyBuildingModel();
  const floor = createFloor({
    label: '1',
    level: 1,
    elevationMm: 0,
    heightMm: 2800,
    floorType: 'full',
    sortIndex: 0,
  });
  model.floors.push(floor);
  const s = 6000;
  const t = 200;
  model.walls.push(
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
  return { model, floor };
}

describe('roof workflow', () => {
  it('buildRoofAssemblyForFloor: двускатная, контур и подпись', () => {
    const { model, floor } = rectangleFloorModel();
    const r = buildRoofAssemblyForFloor(model, floor.id, { roofType: 'gable', slopeDegrees: 25 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.roof.eavesContourMm?.length).toBe(4);
    expect(r.roof.ridgeLineMm).toBeDefined();
    expect(r.roof.sourceWallSignature).toMatch(/\|/);
    expect(r.roof.needsRecompute).toBe(false);
  });

  it('buildRoofAssemblyForFloor: односкатная', () => {
    const { model, floor } = rectangleFloorModel();
    const r = buildRoofAssemblyForFloor(model, floor.id, {
      roofType: 'single_slope',
      ridgeDirection: 'x',
      singleSlopeDrainToward: '+y',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.roof.roofType).toBe('single_slope');
    expect(r.roof.singleSlopeDrainToward).toBe('+y');
  });

  it('незамкнутый контур — ошибка', () => {
    const model = createEmptyBuildingModel();
    const floor = createFloor({
      label: '1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    model.floors.push(floor);
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    const r = buildRoofAssemblyForFloor(model, floor.id);
    expect(r.ok).toBe(false);
  });

  it('recomputeRoofById сохраняет id', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildRoofAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const m = { ...model, roofs: [built.roof] };
    const rec = recomputeRoofById(m, built.roof.id);
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.roof.id).toBe(built.roof.id);
  });

  it('syncRoofStaleFromSignatures после сдвига стены', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildRoofAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let m: typeof model = { ...model, roofs: [built.roof] };
    const w0 = m.walls[0]!;
    const moved = translateWallEndpoints(w0, 50, 0, 'both');
    const uw = updateWallInModel(m, w0.id, { start: moved.start, end: moved.end });
    if (typeof uw === 'object' && uw !== null && 'ok' in uw && (uw as { ok: boolean }).ok === false) {
      throw new Error((uw as { reason: string }).reason);
    }
    m = uw as typeof m;
    const synced = syncRoofStaleFromSignatures(m);
    expect(synced.roofs[0]!.needsRecompute).toBe(true);
  });

  it('normalizeBuildingModel сохраняет поля крыши', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildRoofAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const m = { ...model, roofs: [built.roof] };
    const m1 = normalizeBuildingModel(JSON.parse(JSON.stringify(m)) as unknown);
    expect(m1.roofs).toHaveLength(1);
    expect(m1.roofs[0]!.eavesContourMm?.length).toBeGreaterThanOrEqual(3);
  });
});
