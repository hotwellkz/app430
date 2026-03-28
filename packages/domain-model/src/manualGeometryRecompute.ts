import type { BuildingModel } from '@2wix/shared-types';
import { mergeNearbyWallEndpoints } from './wallEndpointSnap.js';
import { rebuildWallJointsFromWallEndpoints } from './wallJointOps.js';

/** Пересчёт стыков концов стен для ручного чертежа (кластеризация + топология узлов). */
export function recomputeManualBuildingGeometry(model: BuildingModel): BuildingModel {
  const merged = mergeNearbyWallEndpoints(model, 160);
  return rebuildWallJointsFromWallEndpoints(merged, 160);
}
