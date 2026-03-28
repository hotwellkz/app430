import { describe, expect, it } from 'vitest';
import {
  buildSlabAssemblyForFloor,
  buildSlabDeckContourFromExternalWalls,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  markSlabStaleForFloor,
  normalizeBuildingModel,
  syncSlabStaleFromSignatures,
  translateWallEndpoints,
  updateWallInModel,
  upsertFoundationInModel,
  buildFoundationAndScreedForFloor,
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
  const walls = [
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
    }),
  ];
  model.walls.push(...walls);
  return { model, floor };
}

describe('slab workflow', () => {
  it('buildSlabDeckContourFromExternalWalls: успех', () => {
    const { model, floor } = rectangleFloorModel();
    const r = buildSlabDeckContourFromExternalWalls(model, floor.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contourMm.length).toBeGreaterThanOrEqual(3);
    expect(r.basedOnWallIds.length).toBeGreaterThanOrEqual(3);
  });

  it('buildSlabAssemblyForFloor: контур и подпись', () => {
    const { model, floor } = rectangleFloorModel();
    const r = buildSlabAssemblyForFloor(model, floor.id, { thicknessMm: 200 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slab.contourMm?.length).toBeGreaterThanOrEqual(3);
    expect(r.slab.sourceWallSignature).toMatch(/\|/);
    expect(r.slab.needsRecompute).toBe(false);
  });

  it('мало наружных стен — ошибка', () => {
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
    const r = buildSlabAssemblyForFloor(model, floor.id);
    expect(r.ok).toBe(false);
  });

  it('normalize round-trip slab с contourMm', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildSlabAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const m = { ...model, slabs: [built.slab] };
    const raw = JSON.parse(JSON.stringify(m)) as unknown;
    const m1 = normalizeBuildingModel(raw);
    expect(m1.slabs).toHaveLength(1);
    expect(m1.slabs[0]!.contourMm?.length).toBeGreaterThanOrEqual(3);
  });

  it('syncSlabStaleFromSignatures после сдвига стены', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildSlabAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let m = { ...model, slabs: [built.slab] };
    const wallId = m.walls[0]!.id;
    const w = m.walls.find((x) => x.id === wallId)!;
    const g = translateWallEndpoints(w, 200, 0, 'both');
    const uw = updateWallInModel(m, wallId, { start: g.start, end: g.end });
    if (typeof uw === 'object' && uw !== null && 'ok' in uw && (uw as { ok: boolean }).ok === false) {
      throw new Error((uw as { reason: string }).reason);
    }
    m = uw as typeof m;
    m = syncSlabStaleFromSignatures(m);
    expect(m.slabs[0]!.needsRecompute).toBe(true);
  });

  it('markSlabStaleForFloor', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildSlabAssemblyForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let m = { ...model, slabs: [built.slab] };
    m = markSlabStaleForFloor(m, floor.id);
    expect(m.slabs[0]!.needsRecompute).toBe(true);
  });

  it('перекрытие не ломает normalize при наличии foundation', () => {
    const { model, floor } = rectangleFloorModel();
    const fb = buildFoundationAndScreedForFloor(model, floor.id);
    expect(fb.ok).toBe(true);
    if (!fb.ok) return;
    let m = upsertFoundationInModel(model, fb.foundation, fb.screed);
    const sb = buildSlabAssemblyForFloor(m, floor.id);
    expect(sb.ok).toBe(true);
    if (!sb.ok) return;
    m = { ...m, slabs: [sb.slab] };
    const m1 = normalizeBuildingModel(JSON.parse(JSON.stringify(m)) as unknown);
    expect(m1.foundations?.length).toBe(1);
    expect(m1.slabs).toHaveLength(1);
  });
});
