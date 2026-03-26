import type { Point2D, Wall } from '@2wix/shared-types';
import {
  clampOpeningCenterAlongWall,
  openingCenterAllowedRange,
  projectWorldOntoWallAxis,
} from '@2wix/domain-model';

const SNAP_TO_EDGE_MM = 120;

/** Новая позиция центра проёма вдоль стены при перетаскивании (сетка + лёгкий snap к безопасным краям). */
export function proposeOpeningDragAlongWall(
  world: Point2D,
  wall: Wall,
  openingWidthMm: number,
  gridStepMm: number,
  snapEnabled: boolean
): number {
  const { along, wallLengthMm } = projectWorldOntoWallAxis(world, wall);
  let next = clampOpeningCenterAlongWall(along, openingWidthMm, wallLengthMm);
  if (snapEnabled && gridStepMm > 0) {
    next = Math.round(next / gridStepMm) * gridStepMm;
    next = clampOpeningCenterAlongWall(next, openingWidthMm, wallLengthMm);
  }
  const range = openingCenterAllowedRange(openingWidthMm, wallLengthMm);
  if (range && snapEnabled) {
    if (Math.abs(next - range.minCenter) < SNAP_TO_EDGE_MM) next = range.minCenter;
    if (Math.abs(next - range.maxCenter) < SNAP_TO_EDGE_MM) next = range.maxCenter;
  }
  return next;
}
