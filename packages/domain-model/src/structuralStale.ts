import type { BuildingModel } from '@2wix/shared-types';
import { markFoundationLayerStaleForFloor } from './foundationStale.js';
import { markRoofStaleForFloor } from './roofStale.js';
import { markSlabStaleForFloor } from './slabStale.js';

/** После изменения стен: фундамент, перекрытие и крыша этажа помечаются как требующие пересчёта. */
export function markFloorStructuralStale(model: BuildingModel, floorId: string): BuildingModel {
  return markRoofStaleForFloor(
    markSlabStaleForFloor(markFoundationLayerStaleForFloor(model, floorId), floorId),
    floorId
  );
}
