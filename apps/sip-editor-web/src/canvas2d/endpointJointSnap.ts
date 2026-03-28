import { snapPointForWallEndpointEdit } from '@2wix/domain-model';
import type { BuildingModel, Point2D } from '@2wix/shared-types';

const DEFAULT_THRESHOLD_MM = 280;

/** Привязка точки к узлам, концам стен и осям (T-стык) при рисовании/редактировании. */
export function snapPointToNearbyWallJoints(
  p: Point2D,
  model: BuildingModel | null | undefined,
  floorId: string | null | undefined,
  excludeWallId: string,
  thresholdMm: number = DEFAULT_THRESHOLD_MM
): Point2D {
  if (!model || !floorId) return p;
  return snapPointForWallEndpointEdit(model, floorId, p, excludeWallId, thresholdMm);
}
