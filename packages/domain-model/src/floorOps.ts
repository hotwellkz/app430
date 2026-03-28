import type { BuildingModel, Floor, FloorType, Wall } from '@2wix/shared-types';
import { clearWallPanelLayoutsForFloor } from './wallPanelLayoutOps.js';
import { newDomainId } from './ids.js';
import { getOpeningsByFloor } from './openingOps.js';
import { getWallsByFloor } from './wallOps.js';

export const DEFAULT_FLOOR_HEIGHT_MM = 2800;

/** Проверка полей этажа после слияния patch. */
export function validateFloorShape(floor: Floor): string | null {
  if (typeof floor.label !== 'string' || !floor.label.trim()) {
    return 'Укажите название этажа';
  }
  if (!Number.isFinite(floor.level) || !Number.isInteger(floor.level) || floor.level < 1) {
    return 'Уровень — целое число не меньше 1';
  }
  if (!Number.isFinite(floor.elevationMm)) {
    return 'Некорректная отметка (elevation)';
  }
  if (!Number.isFinite(floor.heightMm) || floor.heightMm <= 0) {
    return 'Высота этажа должна быть больше 0';
  }
  if (!Number.isFinite(floor.sortIndex)) {
    return 'Некорректный порядок сортировки';
  }
  const t = floor.floorType;
  if (t !== 'full' && t !== 'mansard' && t !== 'basement') {
    return 'Некорректный тип этажа';
  }
  return null;
}

export function createFloor(
  partial?: Partial<Omit<Floor, 'id'>> & { id?: string }
): Floor {
  const sortIndex = partial?.sortIndex ?? 0;
  const level = partial?.level ?? 1;
  return {
    id: partial?.id ?? newDomainId(),
    label: (partial?.label ?? `Этаж ${level}`).trim() || `Этаж ${level}`,
    elevationMm: partial?.elevationMm ?? 0,
    sortIndex,
    level,
    heightMm:
      partial?.heightMm != null && Number.isFinite(partial.heightMm) && partial.heightMm > 0
        ? partial.heightMm
        : DEFAULT_FLOOR_HEIGHT_MM,
    floorType: (partial?.floorType ?? 'full') satisfies FloorType,
  };
}

export function addFloorToModel(model: BuildingModel, floor: Floor): BuildingModel {
  return {
    ...model,
    floors: [...model.floors, floor],
  };
}

/** Удаляет этаж и связанные стены/проёмы (без проверки «последний этаж»). */
export function deleteFloorFromModel(model: BuildingModel, floorId: string): BuildingModel {
  const withoutLayouts = clearWallPanelLayoutsForFloor(model, floorId);
  const walls = withoutLayouts.walls.filter((w) => w.floorId !== floorId);
  const wallIds = new Set(walls.map((w) => w.id));
  return {
    ...withoutLayouts,
    floors: withoutLayouts.floors.filter((f) => f.id !== floorId),
    walls,
    openings: withoutLayouts.openings.filter((o) => wallIds.has(o.wallId)),
  };
}

export function tryDeleteFloorFromModel(
  model: BuildingModel,
  floorId: string
): { ok: true; model: BuildingModel } | { ok: false; error: string } {
  if (model.floors.length <= 1) {
    return { ok: false, error: 'Нельзя удалить последний этаж' };
  }
  if (!model.floors.some((f) => f.id === floorId)) {
    return { ok: false, error: 'Этаж не найден' };
  }
  return { ok: true, model: deleteFloorFromModel(model, floorId) };
}

export type FloorPatch = Partial<
  Pick<Floor, 'label' | 'level' | 'elevationMm' | 'heightMm' | 'floorType' | 'sortIndex'>
>;

export function updateFloorInModel(
  model: BuildingModel,
  floorId: string,
  patch: FloorPatch
): { ok: true; model: BuildingModel } | { ok: false; reason: string } {
  const idx = model.floors.findIndex((f) => f.id === floorId);
  if (idx < 0) return { ok: false, reason: 'Этаж не найден' };
  const prev = model.floors[idx]!;
  const nextFloor: Floor = { ...prev, ...patch };
  if (typeof nextFloor.label === 'string') {
    nextFloor.label = nextFloor.label.trim() || prev.label;
  }
  const err = validateFloorShape(nextFloor);
  if (err) return { ok: false, reason: err };
  const floors = [...model.floors];
  floors[idx] = nextFloor;
  return { ok: true, model: { ...model, floors } };
}

/**
 * Копирует этаж со стенами и проёмами; новые id у этажа, стен и проёмов.
 * level / elevation / label задаются по умолчанию от исходного этажа.
 */
export function duplicateFloorInModel(
  model: BuildingModel,
  sourceFloorId: string
): { ok: true; model: BuildingModel; newFloorId: string } | { ok: false; error: string } {
  const src = model.floors.find((f) => f.id === sourceFloorId);
  if (!src) return { ok: false, error: 'Этаж не найден' };

  const newFloorId = newDomainId();
  const maxSort = model.floors.reduce((m, f) => Math.max(m, f.sortIndex), -1);

  const newFloor: Floor = createFloor({
    id: newFloorId,
    label: `${src.label} (копия)`,
    level: src.level + 1,
    elevationMm: src.elevationMm + src.heightMm,
    heightMm: src.heightMm,
    floorType: src.floorType,
    sortIndex: maxSort + 1,
  });

  const wallsOnSrc = getWallsByFloor(model, sourceFloorId);
  const wallIdMap = new Map<string, string>();
  for (const w of wallsOnSrc) {
    wallIdMap.set(w.id, newDomainId());
  }

  const jointsOnSrc = (model.wallJoints ?? []).filter((j) => j.floorId === sourceFloorId);
  const jointIdMap = new Map<string, string>();
  for (const j of jointsOnSrc) {
    jointIdMap.set(j.id, newDomainId());
  }
  const newJoints = jointsOnSrc.map((j) => ({
    ...j,
    id: jointIdMap.get(j.id)!,
    floorId: newFloorId,
  }));

  const newWalls: Wall[] = wallsOnSrc.map((w) => {
    const out: Wall = {
      ...w,
      id: wallIdMap.get(w.id)!,
      floorId: newFloorId,
    };
    if (w.startJointId && jointIdMap.has(w.startJointId)) {
      out.startJointId = jointIdMap.get(w.startJointId)!;
    } else {
      delete out.startJointId;
    }
    if (w.endJointId && jointIdMap.has(w.endJointId)) {
      out.endJointId = jointIdMap.get(w.endJointId)!;
    } else {
      delete out.endJointId;
    }
    return out;
  });

  const openingsOnSrc = getOpeningsByFloor(model, sourceFloorId);
  const fixedOpenings = [];
  for (const o of openingsOnSrc) {
    const nw = wallIdMap.get(o.wallId);
    if (!nw) return { ok: false, error: 'Внутренняя ошибка: стена проёма не найдена' };
    fixedOpenings.push({
      ...o,
      id: newDomainId(),
      floorId: newFloorId,
      wallId: nw,
    });
  }

  return {
    ok: true,
    newFloorId,
    model: {
      ...model,
      floors: [...model.floors, newFloor],
      walls: [...model.walls, ...newWalls],
      wallJoints: [...(model.wallJoints ?? []), ...newJoints],
      openings: [...model.openings, ...fixedOpenings],
    },
  };
}

/** Свойства нового этажа по умолчанию (следующий над последним в сортировке). */
export function suggestNextFloor(model: BuildingModel): Omit<Floor, 'id'> {
  const sorted = [...model.floors].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.level - b.level;
  });
  const last = sorted[sorted.length - 1];
  if (!last) {
    return {
      label: '1 этаж',
      level: 1,
      elevationMm: 0,
      heightMm: DEFAULT_FLOOR_HEIGHT_MM,
      floorType: 'full',
      sortIndex: 0,
    };
  }
  const nextLevel = last.level + 1;
  return {
    label: `Этаж ${nextLevel}`,
    level: nextLevel,
    elevationMm: last.elevationMm + last.heightMm,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
    floorType: 'full',
    sortIndex: last.sortIndex + 1,
  };
}

export function applySingleFloorTemplate(model: BuildingModel): BuildingModel {
  if (model.floors.length > 0) return model;
  const f = createFloor({
    label: '1 этаж',
    level: 1,
    elevationMm: 0,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
    floorType: 'full',
    sortIndex: 0,
  });
  return addFloorToModel(model, f);
}

export function applyTwoStoryFloorTemplate(model: BuildingModel): BuildingModel {
  if (model.floors.length > 0) return model;
  const f1 = createFloor({
    label: '1 этаж',
    level: 1,
    elevationMm: 0,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
    floorType: 'full',
    sortIndex: 0,
  });
  const f2 = createFloor({
    label: '2 этаж',
    level: 2,
    elevationMm: DEFAULT_FLOOR_HEIGHT_MM,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
    floorType: 'full',
    sortIndex: 1,
  });
  let m = addFloorToModel(model, f1);
  m = addFloorToModel(m, f2);
  return m;
}
