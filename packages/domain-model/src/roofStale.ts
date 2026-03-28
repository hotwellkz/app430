import type { BuildingModel } from '@2wix/shared-types';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';

export function syncRoofStaleFromSignatures(model: BuildingModel): BuildingModel {
  const list = model.roofs ?? [];
  const roofs = list.map((r) => {
    const cur = computeExternalWallSignatureForFloor(model.walls, r.floorId);
    const stale = cur !== (r.sourceWallSignature ?? '');
    return { ...r, needsRecompute: Boolean(r.needsRecompute || stale) };
  });
  return { ...model, roofs };
}

export function markRoofStaleForFloor(model: BuildingModel, floorId: string): BuildingModel {
  let changed = false;
  const roofs = model.roofs.map((r) => {
    if (r.floorId !== floorId) return r;
    if (!r.needsRecompute) changed = true;
    return { ...r, needsRecompute: true };
  });
  if (!changed) return model;
  return { ...model, roofs };
}
