import type { BuildingModel, FoundationStrip, Wall } from '@2wix/shared-types';
import { isExternalWallForFoundation } from './foundationOuterWallLoop.js';

export function computeExternalWallSignatureForFloor(walls: Wall[], floorId: string): string {
  return walls
    .filter((w) => w.floorId === floorId && isExternalWallForFoundation(w))
    .map(
      (w) =>
        `${w.id}:${w.start.x.toFixed(1)},${w.start.y.toFixed(1)}:${w.end.x.toFixed(1)},${w.end.y.toFixed(1)}`
    )
    .sort()
    .join('|');
}

/** Фундамент нужно пересчитать: изменились стены или флаг needsRecompute. */
export function isFoundationGeometryStale(model: BuildingModel, f: FoundationStrip): boolean {
  const cur = computeExternalWallSignatureForFloor(model.walls, f.floorId);
  return cur !== f.sourceWallSignature || f.needsRecompute;
}
