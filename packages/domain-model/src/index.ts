export {
  BUILDING_MODEL_SCHEMA_VERSION,
  createEmptyBuildingModel,
  createEmptyProject,
  normalizeBuildingModel,
  isBuildingModelEmpty,
  validateProjectCreatePayload,
} from './buildingProject.js';
export { syncBuildingModelMeta } from './metaSync.js';
export { newDomainId } from './ids.js';
export {
  cloneBuildingModel,
  compareBuildingModelsForDirtyCheck,
  findWallById,
  getFloorById,
  getFloorsSorted,
  getWallById,
  getOpeningById,
  assertFloorExists,
  assertWallExists,
  assertOpeningExists,
} from './modelUtils.js';
export {
  DEFAULT_FLOOR_HEIGHT_MM,
  createFloor,
  addFloorToModel,
  deleteFloorFromModel,
  tryDeleteFloorFromModel,
  updateFloorInModel,
  duplicateFloorInModel,
  validateFloorShape,
  suggestNextFloor,
  applySingleFloorTemplate,
  applyTwoStoryFloorTemplate,
} from './floorOps.js';
export type { FloorPatch } from './floorOps.js';
export {
  computeWallLengthMm,
  createWall,
  getWallsByFloor,
  isValidWallGeometry,
  validateWall,
  addWallToModel,
  updateWallInModel,
  deleteWallFromModel,
} from './wallOps.js';
export type {
  AddWallResult,
  UpdateWallResult,
  WallValidationResult,
} from './wallOps.js';
export {
  validateOpening,
  validateOpeningPlacement,
  createOpening,
  addOpeningToModel,
  updateOpeningInModel,
  deleteOpeningFromModel,
  getOpeningsByWall,
  getOpeningsByFloor,
  buildOpeningOnWallClick,
  suggestOpeningCenterAlongWall,
} from './openingOps.js';
export type { OpeningValidationResult, OpeningPatch } from './openingOps.js';
export {
  OPENING_EDGE_MARGIN_MM,
  OPENING_MIN_GAP_ALONG_MM,
  OPENING_MAX_HEIGHT_MM,
  OPENING_MAX_BOTTOM_OFFSET_MM,
  DOOR_BOTTOM_OFFSET_EPS_MM,
} from './openingConstants.js';
export { OPENING_DEFAULTS } from './openingPresets.js';
export type { OpeningSizePreset } from './openingPresets.js';
export {
  projectWorldOntoWallAxis,
  computeOpeningSpanAlongWall,
  openingSpansTooClose,
  clampOpeningCenterAlongWall,
  openingCenterAllowedRange,
  computeOpeningFootprintCorners,
  computeOpeningBoundsOnWall,
  detectOpeningOutOfWallBounds,
  detectOpeningTooCloseToWallEdge,
  detectOpeningOverlap,
} from './openingGeometry.js';
