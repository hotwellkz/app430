import type { BuildingModel, Slab } from '@2wix/shared-types';
import { newDomainId } from './ids.js';
import { getFloorsSorted } from './modelUtils.js';
import { getWallsByFloor } from './wallOps.js';

export const DEFAULT_SLAB_THICKNESS_MM = 220;
export const DEFAULT_SLAB_DIRECTION: Slab['direction'] = 'x';

export function validateSlab(
  slab: Slab,
  model: BuildingModel
): { ok: true } | { ok: false; reason: string } {
  if (!model.floors.some((f) => f.id === slab.floorId)) {
    return { ok: false, reason: 'Этаж перекрытия не найден' };
  }
  if (slab.direction !== 'x' && slab.direction !== 'y') {
    return { ok: false, reason: 'Некорректное направление перекрытия' };
  }
  if (slab.slabType !== 'ground' && slab.slabType !== 'interfloor' && slab.slabType !== 'attic') {
    return { ok: false, reason: 'Некорректный тип перекрытия' };
  }
  if (slab.generationMode !== 'auto' && slab.generationMode !== 'manual') {
    return { ok: false, reason: 'Некорректный generationMode перекрытия' };
  }
  if (slab.thicknessMm !== undefined && (!Number.isFinite(slab.thicknessMm) || slab.thicknessMm <= 0)) {
    return { ok: false, reason: 'Толщина перекрытия должна быть > 0' };
  }
  if (slab.panelizationEnabled !== undefined && typeof slab.panelizationEnabled !== 'boolean') {
    return { ok: false, reason: 'panelizationEnabled перекрытия должен быть boolean' };
  }
  if (slab.panelTypeId !== undefined && typeof slab.panelTypeId !== 'string') {
    return { ok: false, reason: 'panelTypeId перекрытия должен быть string' };
  }
  const wallIds = new Set(model.walls.map((w) => w.id));
  for (const id of slab.contourWallIds) {
    if (!wallIds.has(id)) return { ok: false, reason: 'Контур перекрытия содержит несуществующую стену' };
  }
  return { ok: true };
}

export function inferSlabTypeForFloor(model: BuildingModel, floorId: string): Slab['slabType'] {
  const sorted = getFloorsSorted(model);
  const idx = sorted.findIndex((f) => f.id === floorId);
  if (idx <= 0) return 'ground';
  if (idx === sorted.length - 1) return 'attic';
  return 'interfloor';
}

export function getSlabsByFloor(model: BuildingModel, floorId: string): Slab[] {
  return model.slabs.filter((s) => s.floorId === floorId);
}

export function getDefaultSlabForFloor(model: BuildingModel, floorId: string): Slab {
  const walls = getWallsByFloor(model, floorId);
  return {
    id: newDomainId(),
    floorId,
    slabType: inferSlabTypeForFloor(model, floorId),
    contourWallIds: walls.map((w) => w.id),
    direction: DEFAULT_SLAB_DIRECTION,
    thicknessMm: DEFAULT_SLAB_THICKNESS_MM,
    generationMode: 'auto',
  };
}

export function createSlab(input: Partial<Slab> & Pick<Slab, 'floorId'>): Slab {
  return {
    id: input.id ?? newDomainId(),
    floorId: input.floorId,
    slabType: input.slabType ?? 'interfloor',
    contourWallIds: input.contourWallIds ?? [],
    direction: input.direction ?? DEFAULT_SLAB_DIRECTION,
    thicknessMm: input.thicknessMm ?? DEFAULT_SLAB_THICKNESS_MM,
    generationMode: input.generationMode ?? 'auto',
    ...(input.panelizationEnabled !== undefined ? { panelizationEnabled: input.panelizationEnabled } : {}),
    ...(input.panelTypeId !== undefined ? { panelTypeId: input.panelTypeId } : {}),
  };
}

export function addSlabToModel(
  model: BuildingModel,
  slab: Slab
): { ok: true; model: BuildingModel } | { ok: false; reason: string } {
  const v = validateSlab(slab, model);
  if (!v.ok) return v;
  if (model.slabs.some((s) => s.floorId === slab.floorId)) {
    return { ok: false, reason: 'Для этажа уже есть базовое перекрытие' };
  }
  return { ok: true, model: { ...model, slabs: [...model.slabs, slab] } };
}

export function updateSlabInModel(
  model: BuildingModel,
  slabId: string,
  patch: Partial<
    Pick<
      Slab,
      | 'slabType'
      | 'contourWallIds'
      | 'direction'
      | 'thicknessMm'
      | 'generationMode'
      | 'floorId'
      | 'panelizationEnabled'
      | 'panelTypeId'
    >
  >
): { ok: true; model: BuildingModel } | { ok: false; reason: string } {
  const idx = model.slabs.findIndex((s) => s.id === slabId);
  if (idx < 0) return { ok: false, reason: 'Перекрытие не найдено' };
  const next: Slab = { ...model.slabs[idx]!, ...patch };
  const v = validateSlab(next, model);
  if (!v.ok) return v;
  if (patch.floorId && model.slabs.some((s) => s.floorId === patch.floorId && s.id !== slabId)) {
    return { ok: false, reason: 'Для этажа уже есть базовое перекрытие' };
  }
  const slabs = [...model.slabs];
  slabs[idx] = next;
  return { ok: true, model: { ...model, slabs } };
}

export function deleteSlabFromModel(model: BuildingModel, slabId: string): BuildingModel {
  return { ...model, slabs: model.slabs.filter((s) => s.id !== slabId) };
}
