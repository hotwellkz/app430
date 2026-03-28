import { describe, expect, it } from 'vitest';
import {
  buildFoundationAndScreedForFloor,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  markFoundationLayerStaleForFloor,
  normalizeBuildingModel,
  recomputeFoundationById,
  translateWallEndpoints,
  updateWallInModel,
  upsertFoundationInModel,
} from './index.js';

function rectangleFloorModel() {
  const model = createEmptyBuildingModel('f-test');
  const floor = createFloor({
    label: '1',
    level: 1,
    elevationMm: 0,
    heightMm: 2800,
    floorType: 'full',
    sortIndex: 0,
  });
  model.floors.push(floor);
  const t = 200;
  const s = 6000;
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

describe('foundation workflow', () => {
  it('buildFoundationAndScreedForFloor: успех по валидному контуру', () => {
    const { model, floor } = rectangleFloorModel();
    const r = buildFoundationAndScreedForFloor(model, floor.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.foundation.outerContourMm.length).toBeGreaterThanOrEqual(3);
    expect(r.foundation.innerContourMm.length).toBeGreaterThanOrEqual(3);
    expect(r.screed.contourMm.length).toBeGreaterThanOrEqual(3);
    expect(r.screed.thicknessMm).toBeGreaterThan(0);
  });

  it('buildFoundationAndScreedForFloor: мало наружных стен', () => {
    const model = createEmptyBuildingModel('x');
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
    const r = buildFoundationAndScreedForFloor(model, floor.id);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/минимум|контур/i);
  });

  it('update params + recomputeFoundationById сохраняет id и толщину стяжки', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildFoundationAndScreedForFloor(model, floor.id, { screedThicknessMm: 80 });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let m = upsertFoundationInModel(model, built.foundation, built.screed);
    const fid = built.foundation.id;
    const sid = built.screed.id;
    const rec = recomputeFoundationById(m, fid);
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.foundation.id).toBe(fid);
    expect(rec.screed.id).toBe(sid);
    expect(rec.screed.thicknessMm).toBe(80);
  });

  it('normalize + JSON round-trip сохраняет foundations и groundScreeds', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildFoundationAndScreedForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const m0 = upsertFoundationInModel(model, built.foundation, built.screed);
    const raw = JSON.parse(JSON.stringify(m0)) as unknown;
    const m1 = normalizeBuildingModel(raw);
    expect(m1.foundations?.length).toBe(1);
    expect(m1.groundScreeds?.length).toBe(1);
    expect(m1.foundations![0]!.id).toBe(built.foundation.id);
  });

  it('после сдвига стены фундамент помечается через updateWallInModel + mark stale (интеграция с reduce в editor)', () => {
    const { model, floor } = rectangleFloorModel();
    const built = buildFoundationAndScreedForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let m = upsertFoundationInModel(model, built.foundation, built.screed);
    const wallId = m.walls[0]!.id;
    const w = m.walls.find((x) => x.id === wallId)!;
    const g = translateWallEndpoints(w, 100, 0, 'both');
    const uw = updateWallInModel(m, wallId, { start: g.start, end: g.end });
    if (typeof uw === 'object' && uw !== null && 'ok' in uw && (uw as { ok: boolean }).ok === false) {
      throw new Error((uw as { reason: string }).reason);
    }
    m = uw as typeof m;
    m = markFoundationLayerStaleForFloor(m, floor.id);
    expect(m.foundations![0]!.needsRecompute).toBe(true);
  });
});
