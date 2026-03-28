import type { BuildingModel } from '@2wix/shared-types';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';

/** Синхронизирует needsRecompute у перекрытий с подписью наружных стен (после загрузки). */
export function syncSlabStaleFromSignatures(model: BuildingModel): BuildingModel {
  const slabs = model.slabs.map((s) => {
    const cur = computeExternalWallSignatureForFloor(model.walls, s.floorId);
    const stale = cur !== (s.sourceWallSignature ?? '');
    return { ...s, needsRecompute: Boolean(s.needsRecompute || stale) };
  });
  return { ...model, slabs };
}

/** Помечает перекрытие этажа как устаревшее после изменения стен. */
export function markSlabStaleForFloor(model: BuildingModel, floorId: string): BuildingModel {
  let changed = false;
  const slabs = model.slabs.map((s) => {
    if (s.floorId !== floorId) return s;
    if (!s.needsRecompute) changed = true;
    return { ...s, needsRecompute: true };
  });
  if (!changed) return model;
  return { ...model, slabs };
}
