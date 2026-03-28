import type { BuildingModel, Point2D, Roof, RoofDrainDirection } from '@2wix/shared-types';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';
import { newDomainId } from './ids.js';
import { getFloorById } from './modelUtils.js';
import {
  buildEavesContourFromFootprint,
  buildOuterSipRingContourForRoof,
  validateAxisAlignedRectangleContour,
} from './roofContourBuild.js';
import {
  DEFAULT_ROOF_OVERHANG_MM,
  DEFAULT_ROOF_RIDGE_DIRECTION,
  DEFAULT_ROOF_SLOPE_DEG,
  DEFAULT_ROOF_TYPE,
  defaultSingleSlopeDrain,
  suggestRoofBaseElevation,
} from './roofOps.js';

export type RoofAssemblyBuildResult = { ok: true; roof: Roof } | { ok: false; reason: string };

export interface BuildRoofAssemblyParams {
  roofType?: Roof['roofType'];
  slopeDegrees?: number;
  overhangMm?: number;
  ridgeDirection?: 'x' | 'y';
  singleSlopeDrainToward?: RoofDrainDirection;
  baseElevationMm?: number;
}

function boundsFromPoints(pts: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function ridgeLineGableFromEavesBounds(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  ridgeDirection: 'x' | 'y'
): { a: Point2D; b: Point2D } {
  if (ridgeDirection === 'x') {
    const y = (minY + maxY) / 2;
    return { a: { x: minX, y }, b: { x: maxX, y } };
  }
  const x = (minX + maxX) / 2;
  return { a: { x, y: minY }, b: { x, y: maxY } };
}

/**
 * Одна крыша на верхний этаж: прямоугольный контур SIP + свес.
 */
export function buildRoofAssemblyForFloor(
  model: BuildingModel,
  floorId: string,
  params: BuildRoofAssemblyParams = {}
): RoofAssemblyBuildResult {
  const floor = getFloorById(model, floorId);
  if (!floor) {
    return { ok: false, reason: 'Этаж не найден' };
  }

  const slopeDegrees = params.slopeDegrees ?? DEFAULT_ROOF_SLOPE_DEG;
  if (!Number.isFinite(slopeDegrees) || slopeDegrees <= 0 || slopeDegrees > 75) {
    return { ok: false, reason: 'Уклон крыши должен быть в диапазоне (0, 75]' };
  }

  const overhangMm = params.overhangMm ?? DEFAULT_ROOF_OVERHANG_MM;
  if (!Number.isFinite(overhangMm) || overhangMm < 0) {
    return { ok: false, reason: 'Свес карниза должен быть ≥ 0' };
  }

  const contour = buildOuterSipRingContourForRoof(model, floorId);
  if (!contour.ok) {
    return { ok: false, reason: contour.reason };
  }

  const rect = validateAxisAlignedRectangleContour(contour.contourMm);
  if (!rect.ok) {
    return { ok: false, reason: rect.reason };
  }

  const footprintContourMm = contour.contourMm.map((p) => ({ ...p }));
  const eavesContourMm = buildEavesContourFromFootprint(contour.contourMm, overhangMm);
  const eavesRect = validateAxisAlignedRectangleContour(eavesContourMm);
  if (!eavesRect.ok) {
    return { ok: false, reason: eavesRect.reason };
  }

  const roofType = params.roofType ?? DEFAULT_ROOF_TYPE;
  const ridgeDirection = params.ridgeDirection ?? DEFAULT_ROOF_RIDGE_DIRECTION;
  let singleSlopeDrainToward: RoofDrainDirection | undefined;
  if (roofType === 'single_slope') {
    singleSlopeDrainToward = params.singleSlopeDrainToward ?? defaultSingleSlopeDrain(ridgeDirection);
    const okPerp =
      (ridgeDirection === 'x' && (singleSlopeDrainToward === '+y' || singleSlopeDrainToward === '-y')) ||
      (ridgeDirection === 'y' && (singleSlopeDrainToward === '+x' || singleSlopeDrainToward === '-x'));
    if (!okPerp) {
      return { ok: false, reason: 'Направление слива должно быть перпендикулярно линии верхнего свеса' };
    }
  }

  const eb = boundsFromPoints(eavesContourMm);
  const ridgeLineMm =
    roofType === 'gable' ? ridgeLineGableFromEavesBounds(eb.minX, eb.maxX, eb.minY, eb.maxY, ridgeDirection) : undefined;

  const baseElevationMm =
    params.baseElevationMm !== undefined && Number.isFinite(params.baseElevationMm)
      ? params.baseElevationMm
      : suggestRoofBaseElevation(model, floorId);

  const signature = computeExternalWallSignatureForFloor(model.walls, floorId);

  const roof: Roof = {
    id: newDomainId(),
    floorId,
    roofType,
    slopeDegrees,
    ridgeDirection,
    ...(singleSlopeDrainToward ? { singleSlopeDrainToward } : {}),
    overhangMm,
    baseElevationMm,
    generationMode: 'auto',
    basedOnWallIds: [...contour.basedOnWallIds],
    footprintContourMm,
    eavesContourMm,
    ...(ridgeLineMm ? { ridgeLineMm } : {}),
    sourceWallSignature: signature,
    needsRecompute: false,
    structuralHints: { plannedKinds: ['hip', 'flat'] },
  };

  return { ok: true, roof };
}

export function recomputeRoofById(model: BuildingModel, roofId: string): RoofAssemblyBuildResult {
  const prev = model.roofs.find((r) => r.id === roofId);
  if (!prev) {
    return { ok: false, reason: 'Крыша не найдена' };
  }
  const built = buildRoofAssemblyForFloor(model, prev.floorId, {
    roofType: prev.roofType,
    slopeDegrees: prev.slopeDegrees,
    overhangMm: prev.overhangMm,
    ridgeDirection: prev.ridgeDirection,
    singleSlopeDrainToward: prev.singleSlopeDrainToward,
    baseElevationMm: prev.baseElevationMm,
  });
  if (!built.ok) {
    return built;
  }
  return {
    ok: true,
    roof: {
      ...built.roof,
      id: prev.id,
      generationMode: 'auto',
      panelizationEnabled: prev.panelizationEnabled,
      panelTypeId: prev.panelTypeId,
      metadata: prev.metadata,
      structuralHints: prev.structuralHints ?? built.roof.structuralHints,
    },
  };
}
