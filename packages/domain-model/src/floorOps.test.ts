import { describe, expect, it } from 'vitest';
import {
  applySingleFloorTemplate,
  applyTwoStoryFloorTemplate,
  createEmptyBuildingModel,
  createFloor,
  createOpening,
  createWall,
  duplicateFloorInModel,
  tryDeleteFloorFromModel,
  validateFloorShape,
} from './index.js';

describe('floorOps', () => {
  it('createFloor produces valid shape', () => {
    const f = createFloor({ label: 'Тест', level: 1, sortIndex: 0 });
    expect(validateFloorShape(f)).toBeNull();
  });

  it('rejects invalid floor height', () => {
    const f = createFloor({ label: 'X', level: 1, sortIndex: 0 });
    expect(validateFloorShape({ ...f, heightMm: 0 })).not.toBeNull();
  });

  it('tryDeleteFloorFromModel rejects last floor', () => {
    const f = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const m = { ...createEmptyBuildingModel(), floors: [f] };
    const r = tryDeleteFloorFromModel(m, 'f1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('последний');
  });

  it('duplicateFloor copies walls and openings with new ids', () => {
    const f1 = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      thicknessMm: 200,
    });
    const opening = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 1500,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const m = {
      ...createEmptyBuildingModel(),
      floors: [f1],
      walls: [wall],
      openings: [opening],
    };
    const r = duplicateFloorInModel(m, 'f1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model.floors).toHaveLength(2);
    expect(r.model.walls).toHaveLength(2);
    expect(r.model.openings).toHaveLength(2);
    const newFloorId = r.newFloorId;
    const wNew = r.model.walls.find((w) => w.floorId === newFloorId);
    expect(wNew).toBeDefined();
    expect(wNew!.id).not.toBe('w1');
    const oNew = r.model.openings.find((o) => o.floorId === newFloorId);
    expect(oNew).toBeDefined();
    expect(oNew!.wallId).toBe(wNew!.id);
  });

  it('applySingleFloorTemplate only when no floors', () => {
    const empty = createEmptyBuildingModel();
    const m1 = applySingleFloorTemplate(empty);
    expect(m1.floors).toHaveLength(1);
    const m2 = applySingleFloorTemplate(m1);
    expect(m2.floors).toHaveLength(1);
  });

  it('applyTwoStoryFloorTemplate creates two floors', () => {
    const m = applyTwoStoryFloorTemplate(createEmptyBuildingModel());
    expect(m.floors).toHaveLength(2);
    expect(m.floors[1]!.elevationMm).toBe(m.floors[0]!.heightMm);
  });
});
