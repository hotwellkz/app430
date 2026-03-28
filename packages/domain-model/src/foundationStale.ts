import type { BuildingModel } from '@2wix/shared-types';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';

/** Синхронизирует needsRecompute с подписью наружных стен (после загрузки версии). */
export function syncFoundationStaleFromSignatures(model: BuildingModel): BuildingModel {
  const foundations = (model.foundations ?? []).map((f) => {
    const cur = computeExternalWallSignatureForFloor(model.walls, f.floorId);
    const stale = cur !== f.sourceWallSignature;
    return { ...f, needsRecompute: f.needsRecompute || stale };
  });
  const fmap = new Map(foundations.map((f) => [f.id, f]));
  const groundScreeds = (model.groundScreeds ?? []).map((s) => {
    const ff = fmap.get(s.foundationId);
    return { ...s, needsRecompute: ff?.needsRecompute ?? s.needsRecompute };
  });
  return { ...model, foundations, groundScreeds };
}

/** Помечает фундамент и стяжку этажа как устаревшие после изменения стен. */
export function markFoundationLayerStaleForFloor(model: BuildingModel, floorId: string): BuildingModel {
  const foundations = model.foundations ?? [];
  const groundScreeds = model.groundScreeds ?? [];
  let changed = false;
  const nextF = foundations.map((f) => {
    if (f.floorId !== floorId) return f;
    if (!f.needsRecompute) changed = true;
    return { ...f, needsRecompute: true };
  });
  const nextS = groundScreeds.map((s) => {
    if (s.floorId !== floorId) return s;
    if (!s.needsRecompute) changed = true;
    return { ...s, needsRecompute: true };
  });
  if (!changed) return model;
  return { ...model, foundations: nextF, groundScreeds: nextS };
}
