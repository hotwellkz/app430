import type { BuildingModel, Floor, Wall } from '@2wix/shared-types';
import { getFloorById, getFloorsSorted } from './modelUtils.js';

export interface VerticalWarning {
  code: 'FLOOR_ELEVATION_MISMATCH' | 'MISSING_ROOF' | 'MISSING_INTERFLOOR_SLAB';
  message: string;
  floorId?: string;
}

export function getEffectiveWallHeight(wall: Wall, floor: Floor | undefined): number {
  if (wall.heightMm !== undefined && Number.isFinite(wall.heightMm) && wall.heightMm > 0) {
    return wall.heightMm;
  }
  return floor?.heightMm ?? 2800;
}

export function getWallHeightMode(wall: Wall): 'inherited' | 'overridden' {
  return wall.heightMm === undefined ? 'inherited' : 'overridden';
}

export function collectVerticalWarnings(model: BuildingModel): VerticalWarning[] {
  const out: VerticalWarning[] = [];
  const sorted = getFloorsSorted(model);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const expected = prev.elevationMm + prev.heightMm;
    if (Math.abs(cur.elevationMm - expected) > 1) {
      out.push({
        code: 'FLOOR_ELEVATION_MISMATCH',
        floorId: cur.id,
        message: `Этаж "${cur.label}": отметка ${cur.elevationMm} мм не совпадает с ожидаемой ${expected} мм от предыдущего уровня.`,
      });
    }
    if (model.slabs.filter((s) => s.floorId === prev.id).length === 0) {
      out.push({
        code: 'MISSING_INTERFLOOR_SLAB',
        floorId: prev.id,
        message: `На этаже "${prev.label}" не создано перекрытие.`,
      });
    }
  }
  if (sorted.length > 0 && model.roofs.length === 0) {
    out.push({
      code: 'MISSING_ROOF',
      message: 'Крыша не создана.',
    });
  }
  return out;
}

export function getWallEffectiveHeightFromModel(model: BuildingModel, wall: Wall): number {
  return getEffectiveWallHeight(wall, getFloorById(model, wall.floorId));
}
