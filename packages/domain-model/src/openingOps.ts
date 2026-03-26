import type { BuildingModel, Opening, OpeningType, Point2D, Wall } from '@2wix/shared-types';
import { getWallById } from './modelUtils.js';
import { newDomainId } from './ids.js';
import {
  DOOR_BOTTOM_OFFSET_EPS_MM,
  OPENING_MAX_BOTTOM_OFFSET_MM,
  OPENING_MAX_HEIGHT_MM,
  OPENING_MIN_GAP_ALONG_MM,
} from './openingConstants.js';
import {
  clampOpeningCenterAlongWall,
  computeOpeningSpanAlongWall,
  detectOpeningOutOfWallBounds,
  openingSpansTooClose,
  projectWorldOntoWallAxis,
} from './openingGeometry.js';
import { OPENING_DEFAULTS } from './openingPresets.js';
import { computeWallLengthMm } from './wallOps.js';

export type OpeningValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type OpeningPatch = Partial<
  Pick<
    Opening,
    | 'wallId'
    | 'positionAlongWall'
    | 'widthMm'
    | 'heightMm'
    | 'openingType'
    | 'bottomOffsetMm'
    | 'label'
  >
>;

export function getOpeningsByWall(model: BuildingModel, wallId: string): Opening[] {
  return model.openings.filter((o) => o.wallId === wallId);
}

export function getOpeningsByFloor(model: BuildingModel, floorId: string): Opening[] {
  return model.openings.filter((o) => o.floorId === floorId);
}

export function validateOpeningPlacement(
  opening: Opening,
  model: BuildingModel,
  options?: { excludeOpeningId?: string }
): OpeningValidationResult {
  const wall = getWallById(model, opening.wallId);
  if (!wall) {
    return { ok: false, reason: 'Стена для проёма не найдена' };
  }
  if (opening.floorId !== wall.floorId) {
    return { ok: false, reason: 'Этаж проёма не совпадает со стеной' };
  }
  if (!Number.isFinite(opening.positionAlongWall)) {
    return { ok: false, reason: 'Некорректная позиция вдоль стены' };
  }
  const wallLen = computeWallLengthMm(wall);
  if (opening.positionAlongWall < 0 || opening.positionAlongWall > wallLen + 1e-6) {
    return { ok: false, reason: 'Центр проёма вне длины стены' };
  }
  if (!Number.isFinite(opening.widthMm) || opening.widthMm <= 0) {
    return { ok: false, reason: 'Ширина проёма должна быть > 0' };
  }
  if (!Number.isFinite(opening.heightMm) || opening.heightMm <= 0 || opening.heightMm > OPENING_MAX_HEIGHT_MM) {
    return { ok: false, reason: `Высота проёма должна быть в (0, ${OPENING_MAX_HEIGHT_MM}] мм` };
  }
  if (
    !Number.isFinite(opening.bottomOffsetMm) ||
    opening.bottomOffsetMm < 0 ||
    opening.bottomOffsetMm > OPENING_MAX_BOTTOM_OFFSET_MM
  ) {
    return { ok: false, reason: 'Некорректный bottomOffset' };
  }
  if (opening.openingType === 'door' && opening.bottomOffsetMm > DOOR_BOTTOM_OFFSET_EPS_MM) {
    return { ok: false, reason: 'У двери низ проёма должен быть на уровне пола (bottomOffset ≈ 0)' };
  }
  if (detectOpeningOutOfWallBounds(opening, wall)) {
    return { ok: false, reason: 'Проём выходит за пределы стены или слишком близко к краю' };
  }
  const span = computeOpeningSpanAlongWall(opening);
  if (span.start < -1e-6 || span.end > wallLen + 1e-6) {
    return { ok: false, reason: 'Ширина проёма выходит за границы стены' };
  }
  const onWall = getOpeningsByWall(model, opening.wallId);
  for (const o of onWall) {
    if (options?.excludeOpeningId && o.id === options.excludeOpeningId) continue;
    if (openingSpansTooClose(span, computeOpeningSpanAlongWall(o), OPENING_MIN_GAP_ALONG_MM)) {
      return { ok: false, reason: 'Проёмы на стене пересекаются или слишком близко' };
    }
  }
  return { ok: true };
}

/** @deprecated Используйте validateOpeningPlacement */
export function validateOpening(
  opening: Opening,
  model: BuildingModel,
  options?: { excludeOpeningId?: string }
): OpeningValidationResult {
  return validateOpeningPlacement(opening, model, options);
}

export function createOpening(input: Omit<Opening, 'id'> & { id?: string }): Opening {
  return {
    id: input.id ?? newDomainId(),
    floorId: input.floorId,
    wallId: input.wallId,
    positionAlongWall: input.positionAlongWall,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    bottomOffsetMm: input.bottomOffsetMm,
    openingType: input.openingType,
    ...(input.label !== undefined ? { label: input.label } : {}),
  };
}

/** Предлагаемый центр проёма по клику в мире; учитывает отступы от краёв стены. */
export function suggestOpeningCenterAlongWall(world: Point2D, wall: Wall, widthMm: number): number {
  const { along, wallLengthMm } = projectWorldOntoWallAxis(world, wall);
  return clampOpeningCenterAlongWall(along, widthMm, wallLengthMm);
}

/** Собрать проём для добавления по клику на стену (дефолтные размеры из пресета). */
export function buildOpeningOnWallClick(
  model: BuildingModel,
  wallId: string,
  world: Point2D,
  openingType: OpeningType
): Opening | OpeningValidationResult {
  const wall = getWallById(model, wallId);
  if (!wall) return { ok: false, reason: 'Стена не найдена' };
  const preset = OPENING_DEFAULTS[openingType];
  const positionAlongWall = suggestOpeningCenterAlongWall(world, wall, preset.widthMm);
  const opening = createOpening({
    floorId: wall.floorId,
    wallId,
    positionAlongWall,
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    bottomOffsetMm: preset.bottomOffsetMm,
    openingType,
  });
  const v = validateOpeningPlacement(opening, model);
  if (!v.ok) return v;
  return opening;
}

export function addOpeningToModel(
  model: BuildingModel,
  opening: Opening
): OpeningValidationResult | BuildingModel {
  const v = validateOpeningPlacement(opening, model);
  if (!v.ok) return v;
  return {
    ...model,
    openings: [...model.openings, opening],
  };
}

export function updateOpeningInModel(
  model: BuildingModel,
  openingId: string,
  patch: OpeningPatch
): OpeningValidationResult | BuildingModel {
  const idx = model.openings.findIndex((o) => o.id === openingId);
  if (idx < 0) {
    return { ok: false, reason: 'Проём не найден' };
  }
  const prev = model.openings[idx]!;
  let next: Opening = { ...prev, ...patch };
  const wall = getWallById(model, next.wallId);
  if (wall) {
    next = { ...next, floorId: wall.floorId };
  }
  const v = validateOpeningPlacement(next, model, { excludeOpeningId: openingId });
  if (!v.ok) return v;
  const openings = [...model.openings];
  openings[idx] = next;
  return { ...model, openings };
}

export function deleteOpeningFromModel(model: BuildingModel, openingId: string): BuildingModel {
  return {
    ...model,
    openings: model.openings.filter((o) => o.id !== openingId),
  };
}
