import type { BuildingModel, Roof, RoofDrainDirection } from '@2wix/shared-types';
import { newDomainId } from './ids.js';
import { getFloorById, getFloorsSorted } from './modelUtils.js';

export const DEFAULT_ROOF_SLOPE_DEG = 28;
export const DEFAULT_ROOF_OVERHANG_MM = 400;
export const DEFAULT_ROOF_TYPE: Roof['roofType'] = 'gable';
export const DEFAULT_ROOF_RIDGE_DIRECTION: NonNullable<Roof['ridgeDirection']> = 'x';

export function defaultSingleSlopeDrain(ridgeDirection: 'x' | 'y'): RoofDrainDirection {
  return ridgeDirection === 'x' ? '+y' : '+x';
}

export function getRoofsByFloor(model: BuildingModel, floorId: string): Roof[] {
  return model.roofs.filter((r) => r.floorId === floorId);
}

export function getRoofForTopFloor(model: BuildingModel): Roof | null {
  const top = getTopFloor(model);
  if (!top) return null;
  return model.roofs.find((r) => r.floorId === top.id) ?? null;
}

export function getTopFloor(model: BuildingModel) {
  const sorted = getFloorsSorted(model);
  return sorted[sorted.length - 1] ?? null;
}

export function isTopFloor(model: BuildingModel, floorId: string): boolean {
  const top = getTopFloor(model);
  return top?.id === floorId;
}

export function suggestRoofBaseElevation(model: BuildingModel, floorId: string): number {
  const floor = getFloorById(model, floorId);
  if (!floor) return 0;
  return floor.elevationMm + floor.heightMm;
}

export function validateRoof(
  roof: Roof,
  model: BuildingModel
): { ok: true } | { ok: false; reason: string } {
  if (!getFloorById(model, roof.floorId)) return { ok: false, reason: 'Этаж крыши не найден' };
  if (!isTopFloor(model, roof.floorId)) return { ok: false, reason: 'Крыша должна быть привязана к верхнему этажу' };
  if (roof.roofType !== 'single_slope' && roof.roofType !== 'gable') {
    return { ok: false, reason: 'Некорректный тип крыши' };
  }
  if (!Number.isFinite(roof.slopeDegrees) || roof.slopeDegrees <= 0 || roof.slopeDegrees > 75) {
    return { ok: false, reason: 'Уклон крыши должен быть в диапазоне (0, 75]' };
  }
  const ridgeDir: 'x' | 'y' =
    roof.ridgeDirection === 'y' ? 'y' : roof.ridgeDirection === 'x' ? 'x' : DEFAULT_ROOF_RIDGE_DIRECTION;
  if (roof.ridgeDirection !== undefined && roof.ridgeDirection !== 'x' && roof.ridgeDirection !== 'y') {
    return { ok: false, reason: 'Некорректное направление конька' };
  }
  if (roof.roofType === 'single_slope') {
    const drain = roof.singleSlopeDrainToward ?? defaultSingleSlopeDrain(ridgeDir);
    const perpOk =
      (ridgeDir === 'x' && (drain === '+y' || drain === '-y')) ||
      (ridgeDir === 'y' && (drain === '+x' || drain === '-x'));
    if (!perpOk) {
      return { ok: false, reason: 'Направление слива односката должно быть перпендикулярно оси верхнего свеса' };
    }
  }
  if (!Number.isFinite(roof.overhangMm) || roof.overhangMm < 0) {
    return { ok: false, reason: 'Свес крыши должен быть >= 0' };
  }
  if (!Number.isFinite(roof.baseElevationMm)) {
    return { ok: false, reason: 'Некорректная базовая отметка крыши' };
  }
  if (roof.panelizationEnabled !== undefined && typeof roof.panelizationEnabled !== 'boolean') {
    return { ok: false, reason: 'panelizationEnabled крыши должен быть boolean' };
  }
  if (roof.panelTypeId !== undefined && typeof roof.panelTypeId !== 'string') {
    return { ok: false, reason: 'panelTypeId крыши должен быть string' };
  }
  if (roof.generationMode !== 'auto') return { ok: false, reason: 'Для MVP generationMode крыши должен быть auto' };
  return { ok: true };
}

export function createRoof(input: Partial<Roof> & Pick<Roof, 'floorId'>): Roof {
  const roofType = input.roofType ?? DEFAULT_ROOF_TYPE;
  const ridgeDirection = input.ridgeDirection ?? DEFAULT_ROOF_RIDGE_DIRECTION;
  const singleSlopeDrainToward =
    roofType === 'single_slope'
      ? (input.singleSlopeDrainToward ?? defaultSingleSlopeDrain(ridgeDirection))
      : input.singleSlopeDrainToward;
  return {
    id: input.id ?? newDomainId(),
    floorId: input.floorId,
    roofType,
    slopeDegrees: input.slopeDegrees ?? DEFAULT_ROOF_SLOPE_DEG,
    ridgeDirection,
    ...(singleSlopeDrainToward ? { singleSlopeDrainToward } : {}),
    overhangMm: input.overhangMm ?? DEFAULT_ROOF_OVERHANG_MM,
    baseElevationMm: input.baseElevationMm ?? 0,
    generationMode: 'auto',
    ...(input.basedOnWallIds ? { basedOnWallIds: input.basedOnWallIds } : {}),
    ...(input.footprintContourMm ? { footprintContourMm: input.footprintContourMm } : {}),
    ...(input.eavesContourMm ? { eavesContourMm: input.eavesContourMm } : {}),
    ...(input.ridgeLineMm ? { ridgeLineMm: input.ridgeLineMm } : {}),
    ...(input.sourceWallSignature !== undefined ? { sourceWallSignature: input.sourceWallSignature } : {}),
    ...(input.needsRecompute !== undefined ? { needsRecompute: input.needsRecompute } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.structuralHints ? { structuralHints: input.structuralHints } : {}),
    ...(input.panelizationEnabled !== undefined ? { panelizationEnabled: input.panelizationEnabled } : {}),
    ...(input.panelTypeId !== undefined ? { panelTypeId: input.panelTypeId } : {}),
  };
}

export function addRoofToModel(
  model: BuildingModel,
  roof: Roof
): { ok: true; model: BuildingModel } | { ok: false; reason: string } {
  const v = validateRoof(roof, model);
  if (!v.ok) return v;
  if (model.roofs.length > 0) return { ok: false, reason: 'В простом режиме допускается одна основная крыша' };
  return { ok: true, model: { ...model, roofs: [roof] } };
}

export function updateRoofInModel(
  model: BuildingModel,
  roofId: string,
  patch: Partial<
    Pick<
      Roof,
      | 'roofType'
      | 'slopeDegrees'
      | 'ridgeDirection'
      | 'singleSlopeDrainToward'
      | 'overhangMm'
      | 'baseElevationMm'
      | 'floorId'
      | 'panelizationEnabled'
      | 'panelTypeId'
      | 'basedOnWallIds'
      | 'footprintContourMm'
      | 'eavesContourMm'
      | 'ridgeLineMm'
      | 'sourceWallSignature'
      | 'needsRecompute'
      | 'metadata'
      | 'structuralHints'
    >
  >
): { ok: true; model: BuildingModel } | { ok: false; reason: string } {
  const idx = model.roofs.findIndex((r) => r.id === roofId);
  if (idx < 0) return { ok: false, reason: 'Крыша не найдена' };
  const next: Roof = { ...model.roofs[idx]!, ...patch, generationMode: 'auto' };
  const v = validateRoof(next, model);
  if (!v.ok) return v;
  const roofs = [...model.roofs];
  roofs[idx] = next;
  return { ok: true, model: { ...model, roofs } };
}

export function deleteRoofFromModel(model: BuildingModel, roofId: string): BuildingModel {
  return { ...model, roofs: model.roofs.filter((r) => r.id !== roofId) };
}
