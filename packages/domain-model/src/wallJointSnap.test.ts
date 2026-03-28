import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addWallToModel,
  attachWallEndpointsToJoints,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  normalizeBuildingModel,
  snapPointForWallEndpointEdit,
} from './index.js';

describe('snapPointForWallEndpointEdit', () => {
  it('привязывает к внутренней точке оси стены (T)', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    m = addFloorToModel(m, f);
    const host = createWall({
      floorId: f.id,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    });
    let r = addWallToModel(m, host);
    m = attachWallEndpointsToJoints(r as typeof m, host.id, 160);
    const p = { x: 2500, y: 350 };
    const snapped = snapPointForWallEndpointEdit(m, f.id, p, 'branch', 500);
    expect(snapped.x).toBeCloseTo(2500, 3);
    expect(snapped.y).toBeCloseTo(0, 3);
  });

  it('JSON roundtrip сохраняет wallJoints', () => {
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
    const raw = JSON.parse(JSON.stringify(m)) as unknown;
    const n = normalizeBuildingModel(raw);
    expect(n.wallJoints?.length).toBeGreaterThanOrEqual(2);
    expect(n.walls[0]!.startJointId).toBeDefined();
  });
});
