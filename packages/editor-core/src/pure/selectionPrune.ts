import type { BuildingModel } from '@2wix/shared-types';
import type { SelectionState } from '../types/state.js';

/** Сбрасывает выделение, если объект больше не существует в draft-модели. */
export function pruneSelectionForModel(
  selection: SelectionState,
  model: BuildingModel
): SelectionState {
  const { selectedObjectId, selectedObjectType, hoveredObjectId, hoveredObjectType } =
    selection;

  let nextSel = { ...selection };

  if (selectedObjectId && selectedObjectType) {
    const exists = objectExistsInModel(model, selectedObjectId, selectedObjectType);
    if (!exists) {
      nextSel = {
        ...nextSel,
        selectedObjectId: null,
        selectedObjectType: null,
        multiSelectIds: [],
      };
    }
  }

  if (hoveredObjectId && hoveredObjectType) {
    const exists = objectExistsInModel(model, hoveredObjectId, hoveredObjectType);
    if (!exists) {
      nextSel = {
        ...nextSel,
        hoveredObjectId: null,
        hoveredObjectType: null,
      };
    }
  }

  return nextSel;
}

function objectExistsInModel(
  model: BuildingModel,
  id: string,
  type: NonNullable<SelectionState['selectedObjectType']>
): boolean {
  switch (type) {
    case 'wall':
      return model.walls.some((w) => w.id === id);
    case 'floor':
      return model.floors.some((f) => f.id === id);
    case 'opening':
      return model.openings.some((o) => o.id === id);
    case 'slab':
      return model.slabs.some((s) => s.id === id);
    case 'roof':
      return model.roofs.some((r) => r.id === id);
    case 'foundation':
      return (model.foundations ?? []).some((f) => f.id === id);
    case 'groundScreed':
      return (model.groundScreeds ?? []).some((s) => s.id === id);
    default:
      return false;
  }
}
