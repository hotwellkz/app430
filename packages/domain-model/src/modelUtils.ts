import type { BuildingModel, Floor, Opening, Wall } from '@2wix/shared-types';

/** Этажи в порядке отображения: sortIndex, затем level. */
export function getFloorsSorted(model: BuildingModel): Floor[] {
  return [...model.floors].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    if (a.level !== b.level) return a.level - b.level;
    return a.elevationMm - b.elevationMm;
  });
}

/** Глубокая копия модели здания (structuredClone при наличии). */
export function cloneBuildingModel(model: BuildingModel): BuildingModel {
  return structuredClone(model);
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableSerialize(v)).join(',')}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(o[k])}`).join(',')}}`;
}

/**
 * Сравнение моделей для dirty-check (детерминированная сериализация).
 * Не для криптографии; достаточно для «есть ли несохранённые правки».
 */
export function compareBuildingModelsForDirtyCheck(a: BuildingModel, b: BuildingModel): boolean {
  return stableSerialize(a) === stableSerialize(b);
}

export function getFloorById(model: BuildingModel, floorId: string): Floor | undefined {
  return model.floors.find((f) => f.id === floorId);
}

export function getWallById(model: BuildingModel, wallId: string): Wall | undefined {
  return model.walls.find((w) => w.id === wallId);
}

/** Синоним для читаемости в редакторах. */
export function findWallById(model: BuildingModel, wallId: string): Wall | undefined {
  return getWallById(model, wallId);
}

export function getOpeningById(model: BuildingModel, openingId: string): Opening | undefined {
  return model.openings.find((o) => o.id === openingId);
}

export function assertFloorExists(
  model: BuildingModel,
  floorId: string
): Floor | { error: string } {
  const f = getFloorById(model, floorId);
  if (!f) return { error: `Этаж не найден: ${floorId}` };
  return f;
}

export function assertWallExists(
  model: BuildingModel,
  wallId: string
): Wall | { error: string } {
  const w = getWallById(model, wallId);
  if (!w) return { error: `Стена не найдена: ${wallId}` };
  return w;
}

export function assertOpeningExists(
  model: BuildingModel,
  openingId: string
): Opening | { error: string } {
  const o = getOpeningById(model, openingId);
  if (!o) return { error: `Проём не найден: ${openingId}` };
  return o;
}
