import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addWallToModel,
  attachWallEndpointsToJoints,
  countWallsReferencingJoint,
  createEmptyBuildingModel,
  createWall,
  createFloor,
  detachWallEndpointInModel,
  getWallJointById,
  moveWallJointInModel,
  updateWallInModel,
} from './index.js';

describe('wallJointOps', () => {
  it('attachWallEndpointsToJoints создаёт два узла у изолированной стены', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    const r = addWallToModel(m, w);
    if ('ok' in r && r.ok === false) throw new Error(r.reason);
    m = attachWallEndpointsToJoints(r as typeof m, w.id, 160);
    expect(m.wallJoints?.length).toBe(2);
    expect(m.walls[0]!.startJointId).toBeDefined();
    expect(m.walls[0]!.endJointId).toBeDefined();
  });

  it('две стены в углу делят один узел', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w1 = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, w1);
    if ('ok' in r && r.ok === false) throw new Error(r.reason);
    m = attachWallEndpointsToJoints(r as typeof m, w1.id, 160);
    const w2 = createWall({
      floorId: f.id,
      start: { x: 1000, y: 0 },
      end: { x: 1000, y: 1000 },
      thicknessMm: 200,
    });
    r = addWallToModel(m, w2);
    if ('ok' in r && r.ok === false) throw new Error(r.reason);
    m = attachWallEndpointsToJoints(r as typeof m, w2.id, 160);
    const jEnd1 = m.walls.find((x) => x.id === w1.id)!.endJointId;
    const jStart2 = m.walls.find((x) => x.id === w2.id)!.startJointId;
    expect(jEnd1).toBe(jStart2);
    expect(countWallsReferencingJoint(m, jEnd1!)).toBe(2);
  });

  it('moveWallJoint двигает все стены с этим узлом', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w1 = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, w1);
    m = attachWallEndpointsToJoints(r as typeof m, w1.id, 160);
    const w2 = createWall({
      floorId: f.id,
      start: { x: 1000, y: 0 },
      end: { x: 1000, y: 1000 },
      thicknessMm: 200,
    });
    r = addWallToModel(m, w2);
    m = attachWallEndpointsToJoints(r as typeof m, w2.id, 160);
    const jid = m.walls.find((x) => x.id === w1.id)!.endJointId!;
    const moved = moveWallJointInModel(m, jid, { x: 1100, y: 0 });
    if ('ok' in moved && (moved as { ok?: boolean }).ok === false) throw new Error();
    const m2 = moved as typeof m;
    const a = m2.walls.find((x) => x.id === w1.id)!;
    const b = m2.walls.find((x) => x.id === w2.id)!;
    expect(a.end.x).toBe(1100);
    expect(b.start.x).toBe(1100);
  });

  it('detachWallEndpoint снимает ссылку на узел', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, w);
    m = attachWallEndpointsToJoints(r as typeof m, w.id, 160);
    const beforeJ = m.wallJoints!.length;
    r = detachWallEndpointInModel(m, w.id, 'start');
    if ('ok' in r && (r as { ok?: boolean }).ok === false) throw new Error();
    m = r as typeof m;
    expect(m.walls[0]!.startJointId).toBeUndefined();
    expect(m.wallJoints!.length).toBeLessThanOrEqual(beforeJ);
  });

  it('updateWall переносит общий узел', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const w1 = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, w1);
    m = attachWallEndpointsToJoints(r as typeof m, w1.id, 160);
    const w2 = createWall({
      floorId: f.id,
      start: { x: 1000, y: 0 },
      end: { x: 1000, y: 1000 },
      thicknessMm: 200,
    });
    r = addWallToModel(m, w2);
    m = attachWallEndpointsToJoints(r as typeof m, w2.id, 160);
    const jid = m.walls.find((x) => x.id === w2.id)!.startJointId!;
    r = updateWallInModel(m, w2.id, { start: { x: 1000, y: 200 } });
    if ('ok' in r && r.ok === false) throw new Error(r.reason);
    m = r as typeof m;
    const w1n = m.walls.find((x) => x.id === w1.id)!;
    expect(w1n.end.y).toBe(200);
    expect(m.walls.find((x) => x.id === w2.id)!.start.y).toBe(200);
    expect(getWallJointById(m, jid)?.y).toBe(200);
  });
});
