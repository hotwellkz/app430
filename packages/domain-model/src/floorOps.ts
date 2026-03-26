import type { BuildingModel, Floor } from '@2wix/shared-types';
import { newDomainId } from './ids.js';

export function createFloor(partial?: Partial<Omit<Floor, 'id'>> & { id?: string }): Floor {
  const sortIndex = partial?.sortIndex ?? 0;
  return {
    id: partial?.id ?? newDomainId(),
    label: partial?.label ?? 'Этаж 1',
    elevationMm: partial?.elevationMm ?? 0,
    sortIndex,
  };
}

export function addFloorToModel(model: BuildingModel, floor: Floor): BuildingModel {
  return {
    ...model,
    floors: [...model.floors, floor],
  };
}

export function deleteFloorFromModel(model: BuildingModel, floorId: string): BuildingModel {
  const walls = model.walls.filter((w) => w.floorId !== floorId);
  const wallIds = new Set(walls.map((w) => w.id));
  return {
    ...model,
    floors: model.floors.filter((f) => f.id !== floorId),
    walls,
    openings: model.openings.filter((o) => wallIds.has(o.wallId)),
  };
}
