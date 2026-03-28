import { describe, expect, it } from 'vitest';
import { OPENING_DEFAULTS } from './openingPresets.js';
import {
  addFloorToModel,
  addOpeningToModel,
  addWallToModel,
  attachWallEndpointsToJoints,
  buildOpeningOnWallClick,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  normalizeBuildingModel,
  updateOpeningInModel,
} from './index.js';

describe('openingOps', () => {
  it('OPENING_DEFAULTS соответствуют ручному сценарию', () => {
    expect(OPENING_DEFAULTS.window).toEqual({ widthMm: 1250, heightMm: 1300, bottomOffsetMm: 900 });
    expect(OPENING_DEFAULTS.door).toEqual({ widthMm: 900, heightMm: 2100, bottomOffsetMm: 0 });
    expect(OPENING_DEFAULTS.portal).toEqual({ widthMm: 900, heightMm: 2100, bottomOffsetMm: 0 });
  });

  it('buildOpeningOnWallClick привязывает проём к стене и клампит вдоль оси', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 8000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, w);
    m = attachWallEndpointsToJoints(r as typeof m, w.id, 160);
    const wallId = m.walls[0]!.id;
    const built = buildOpeningOnWallClick(m, wallId, { x: 100, y: 500 }, 'window');
    if ('ok' in built && built.ok === false) throw new Error(built.reason);
    const op = built as import('@2wix/shared-types').Opening;
    expect(op.wallId).toBe(wallId);
    expect(op.positionAlongWall).toBeGreaterThan(0);
    expect(op.positionAlongWall).toBeLessThan(8000);
  });

  it('слишком широкий проём не добавляется', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 500, y: 0 },
      thicknessMm: 200,
    });
    m = addWallToModel(m, w) as typeof m;
    m = attachWallEndpointsToJoints(m, w.id, 160);
    const wallId = m.walls[0]!.id;
    const r = addOpeningToModel(m, {
      id: 'o1',
      floorId: f.id,
      wallId,
      positionAlongWall: 250,
      widthMm: 4000,
      heightMm: 2000,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    expect('ok' in r && r.ok === false).toBe(true);
  });

  it('обновление offset и размеров проходит валидацию', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
      thicknessMm: 200,
    });
    m = attachWallEndpointsToJoints(addWallToModel(m, w) as typeof m, w.id, 160);
    const wallId = m.walls[0]!.id;
    const o = buildOpeningOnWallClick(m, wallId, { x: 3000, y: 0 }, 'door');
    if ('ok' in o && o.ok === false) throw new Error();
    m = addOpeningToModel(m, o as import('@2wix/shared-types').Opening) as typeof m;
    const oid = m.openings[0]!.id;
    const u = updateOpeningInModel(m, oid, { positionAlongWall: 3100, widthMm: 800 });
    if ('ok' in u && u.ok === false) throw new Error();
    expect((u as typeof m).openings[0]!.positionAlongWall).toBe(3100);
  });

  it('normalize сохраняет openings', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    });
    m = attachWallEndpointsToJoints(addWallToModel(m, w) as typeof m, w.id, 160);
    const wallId = m.walls[0]!.id;
    const bo = buildOpeningOnWallClick(m, wallId, { x: 2000, y: 0 }, 'window');
    if ('ok' in bo && bo.ok === false) throw new Error();
    m = addOpeningToModel(m, bo as import('@2wix/shared-types').Opening) as typeof m;
    const n = normalizeBuildingModel(JSON.parse(JSON.stringify(m)) as unknown);
    expect(n.openings).toHaveLength(1);
  });
});
