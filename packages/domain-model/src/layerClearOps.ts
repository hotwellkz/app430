import type { BuildingModel } from '@2wix/shared-types';
import { clearWallPanelLayoutsForFloor } from './wallPanelLayoutOps.js';
import { deleteOpeningFromModel, getOpeningsByFloor } from './openingOps.js';
import { deleteWallFromModel, getWallsByFloor } from './wallOps.js';

/** Удаляет все стены этажа и связанные проёмы; пересчитывает стыки. */
export function clearWallsForFloor(model: BuildingModel, floorId: string): BuildingModel {
  let m = clearWallPanelLayoutsForFloor(model, floorId);
  const ids = getWallsByFloor(m, floorId).map((w) => w.id);
  for (const id of ids) {
    m = deleteWallFromModel(m, id);
  }
  return m;
}

/** Удаляет только проёмы на этаже (стены без изменений). */
export function clearOpeningsForFloor(model: BuildingModel, floorId: string): BuildingModel {
  let m = model;
  const openings = getOpeningsByFloor(m, floorId);
  for (const o of openings) {
    m = deleteOpeningFromModel(m, o.id);
  }
  return m;
}

/** Удаляет ленты фундамента и стяжки (модель groundScreeds). */
export function clearFoundationsAndScreeds(model: BuildingModel): BuildingModel {
  return {
    ...model,
    foundations: [],
    groundScreeds: [],
  };
}

export function clearSlabs(model: BuildingModel): BuildingModel {
  return { ...model, slabs: [] };
}

export function clearRoofs(model: BuildingModel): BuildingModel {
  return { ...model, roofs: [] };
}
