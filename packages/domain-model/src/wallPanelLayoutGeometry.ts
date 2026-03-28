import type { BuildingModel } from '@2wix/shared-types';
import { getOpeningsByWall } from './openingOps.js';
import { getWallById } from './modelUtils.js';

/**
 * Детерминированная подпись геометрии стены и проёмов для dirty-check раскладки.
 */
export function computeWallPanelizationGeometrySignature(model: BuildingModel, wallId: string): string {
  const wall = getWallById(model, wallId);
  if (!wall) return '';
  const openings = getOpeningsByWall(model, wallId).sort((a, b) => a.id.localeCompare(b.id));
  const w = [
    Math.round(wall.start.x),
    Math.round(wall.start.y),
    Math.round(wall.end.x),
    Math.round(wall.end.y),
    wall.thicknessMm,
    wall.heightMm ?? '',
    wall.panelTypeId ?? '',
    wall.panelDirection ?? '',
  ].join(':');
  const o = openings
    .map((op) =>
      [
        op.id,
        op.openingType,
        Math.round(op.positionAlongWall),
        Math.round(op.widthMm),
        Math.round(op.heightMm),
        Math.round(op.bottomOffsetMm),
      ].join(':')
    )
    .join('|');
  return `${w}#${o}`;
}
