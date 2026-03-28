export {
  BUILDING_MODEL_SCHEMA_VERSION,
  createEmptyBuildingModel,
  createEmptyProject,
  normalizeBuildingModel,
  isBuildingModelEmpty,
  validateProjectCreatePayload,
} from './buildingProject.js';
export {
  upsertWallPanelLayout,
  clearWallPanelLayout,
  mergeWallPanelLayouts,
  clearWallPanelLayoutsForFloor,
  markWallPanelLayoutsStaleForWallIds,
} from './wallPanelLayoutOps.js';
export { computeWallPanelizationGeometrySignature } from './wallPanelLayoutGeometry.js';
export { buildDraftSipBomSnapshot, isWallPanelLayoutOutdated } from './draftSipBom.js';
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
export { baselineSegmentToCenterline, centerlineSegmentToBaseline } from './wallBaseline.js';
export { wallFootprintCorners, wallPolygonPointsMm } from './wallGeometry.js';
export { mergeNearbyWallEndpoints } from './wallEndpointSnap.js';
export { recomputeManualBuildingGeometry } from './manualGeometryRecompute.js';
export {
  attachWallEndpointsToJoints,
  applyWallGeometryPatch,
  countWallsReferencingJoint,
  detachWallEndpointInModel,
  ensureWallJointsArray,
  getWallJointById,
  moveWallJointInModel,
  pruneUnusedWallJoints,
  rebuildWallJointsFromWallEndpoints,
  wallsOnFloorAfterJointMove,
} from './wallJointOps.js';
export { snapPointForWallEndpointEdit } from './wallJointSnap.js';
export {
  endPointForLengthFromStart,
  parsePositiveMmString,
  rectangleOppositeCornerFromSize,
  translateWallEndpoints,
  wallDirectionDegrees,
} from './wallNumericEdit.js';
export type { TranslateAxis } from './wallNumericEdit.js';
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
  openingCenterWorldMm,
} from './openingGeometry.js';
export {
  DEFAULT_SLAB_DIRECTION,
  DEFAULT_SLAB_THICKNESS_MM,
  addSlabToModel,
  createSlab,
  deleteSlabFromModel,
  getDefaultSlabForFloor,
  getSlabsByFloor,
  inferSlabTypeForFloor,
  updateSlabInModel,
  validateSlab,
} from './slabOps.js';
export { buildSlabDeckContourFromExternalWalls } from './slabContourBuild.js';
export { syncSlabStaleFromSignatures, markSlabStaleForFloor } from './slabStale.js';
export {
  buildSlabAssemblyForFloor,
  recomputeSlabById,
} from './slabAssemblyBuild.js';
export type { BuildSlabAssemblyParams, SlabAssemblyBuildResult } from './slabAssemblyBuild.js';
export { markFloorStructuralStale } from './structuralStale.js';
export {
  buildEavesContourFromFootprint,
  buildOuterSipRingContourForRoof,
  validateAxisAlignedRectangleContour,
} from './roofContourBuild.js';
export {
  buildRoofAssemblyForFloor,
  recomputeRoofById,
} from './roofAssemblyBuild.js';
export type { BuildRoofAssemblyParams, RoofAssemblyBuildResult } from './roofAssemblyBuild.js';
export { syncRoofStaleFromSignatures, markRoofStaleForFloor } from './roofStale.js';
export {
  DEFAULT_ROOF_OVERHANG_MM,
  DEFAULT_ROOF_RIDGE_DIRECTION,
  DEFAULT_ROOF_SLOPE_DEG,
  DEFAULT_ROOF_TYPE,
  defaultSingleSlopeDrain,
  addRoofToModel,
  createRoof,
  deleteRoofFromModel,
  getRoofForTopFloor,
  getRoofsByFloor,
  getTopFloor,
  isTopFloor,
  suggestRoofBaseElevation,
  updateRoofInModel,
  validateRoof,
} from './roofOps.js';
export {
  collectVerticalWarnings,
  getEffectiveWallHeight,
  getWallEffectiveHeightFromModel,
  getWallHeightMode,
} from './verticalModel.js';
export type { VerticalWarning } from './verticalModel.js';
export {
  DEFAULT_FOUNDATION_WIDTH_MM,
  DEFAULT_FOUNDATION_HEIGHT_MM,
  DEFAULT_FOUNDATION_OUTER_OFFSET_MM,
  DEFAULT_FOUNDATION_INNER_OFFSET_MM,
  DEFAULT_SCREED_THICKNESS_MM,
  FOUNDATION_WALL_ENDPOINT_TOL_MM,
} from './foundationConstants.js';
export {
  wallsShareEndpoint,
  isExternalWallForFoundation,
  orderExternalWallsInRing,
} from './foundationOuterWallLoop.js';
export {
  polygonAreaSigned,
  lineIntersectionInfinite,
  polygonSelfIntersects,
  offsetClosedPolygonOutward,
  buildOuterSipRing,
  buildFoundationContours,
} from './foundationStripBuild.js';
export {
  computeExternalWallSignatureForFloor,
  isFoundationGeometryStale,
} from './foundationSignature.js';
export { markFoundationLayerStaleForFloor, syncFoundationStaleFromSignatures } from './foundationStale.js';
export {
  buildFoundationAndScreedForFloor,
  upsertFoundationInModel,
  deleteFoundationForFloor,
  findFoundationByFloor,
  findGroundScreedByFloor,
  updateFoundationInModel,
  updateGroundScreedInModel,
  recomputeFoundationById,
  deleteFoundationById,
} from './foundationOps.js';
export type { CreateFoundationParams, FoundationBuildResult } from './foundationOps.js';
export {
  clearWallsForFloor,
  clearOpeningsForFloor,
  clearFoundationsAndScreeds,
  clearSlabs,
  clearRoofs,
} from './layerClearOps.js';
