import type { BuildingModel, Point2D, Wall } from '@2wix/shared-types';
import { findWallById, getFloorById } from './modelUtils.js';
import { newDomainId } from './ids.js';
import { applyWallGeometryPatch, pruneUnusedWallJoints } from './wallJointOps.js';
import { clearWallPanelLayout } from './wallPanelLayoutOps.js';

const LENGTH_EPS_MM = 1e-3;

function distanceMm(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export type WallValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type AddWallResult = BuildingModel | { ok: false; reason: string };

export function computeWallLengthMm(wall: Pick<Wall, 'start' | 'end'>): number {
  return distanceMm(wall.start, wall.end);
}

export function isValidWallGeometry(wall: Wall, model: BuildingModel): boolean {
  return validateWall(wall, model).ok;
}

export function validateWall(wall: Wall, model: BuildingModel): WallValidationResult {
  if (!getFloorById(model, wall.floorId)) {
    return { ok: false, reason: 'Указанный этаж не существует' };
  }
  const len = distanceMm(wall.start, wall.end);
  if (len <= LENGTH_EPS_MM) {
    return { ok: false, reason: 'Начало и конец стены совпадают или длина равна нулю' };
  }
  if (wall.thicknessMm <= 0 || !Number.isFinite(wall.thicknessMm)) {
    return { ok: false, reason: 'Толщина стены должна быть положительным числом' };
  }
  if (wall.heightMm !== undefined) {
    if (!Number.isFinite(wall.heightMm) || wall.heightMm <= 0) {
      return { ok: false, reason: 'Высота стены должна быть положительным числом' };
    }
  }
  if (wall.structuralRole !== undefined) {
    if (wall.structuralRole !== 'bearing' && wall.structuralRole !== 'partition') {
      return { ok: false, reason: 'Некорректная structuralRole стены' };
    }
  }
  if (wall.panelDirection !== undefined) {
    if (wall.panelDirection !== 'vertical' && wall.panelDirection !== 'horizontal') {
      return { ok: false, reason: 'Некорректное направление панелизации стены' };
    }
  }
  if (wall.wallPlacement !== undefined) {
    const p = wall.wallPlacement;
    if (p !== 'on-axis' && p !== 'inside' && p !== 'outside') {
      return { ok: false, reason: 'Некорректный wallPlacement' };
    }
  }
  return { ok: true };
}

export function createWall(input: {
  floorId: string;
  start: Point2D;
  end: Point2D;
  thicknessMm: number;
  id?: string;
  wallType?: Wall['wallType'];
  structuralRole?: Wall['structuralRole'];
  panelizationEnabled?: Wall['panelizationEnabled'];
  panelDirection?: Wall['panelDirection'];
  panelTypeId?: Wall['panelTypeId'];
  heightMm?: number;
  wallPlacement?: Wall['wallPlacement'];
}): Wall {
  const w: Wall = {
    id: input.id ?? newDomainId(),
    floorId: input.floorId,
    start: { ...input.start },
    end: { ...input.end },
    thicknessMm: input.thicknessMm,
  };
  if (input.wallType !== undefined) w.wallType = input.wallType;
  if (input.structuralRole !== undefined) w.structuralRole = input.structuralRole;
  if (input.panelizationEnabled !== undefined) w.panelizationEnabled = input.panelizationEnabled;
  if (input.panelDirection !== undefined) w.panelDirection = input.panelDirection;
  if (input.panelTypeId !== undefined) w.panelTypeId = input.panelTypeId;
  if (input.heightMm !== undefined) w.heightMm = input.heightMm;
  if (input.wallPlacement !== undefined) w.wallPlacement = input.wallPlacement;
  return w;
}

export function addWallToModel(model: BuildingModel, wall: Wall): AddWallResult {
  const v = validateWall(wall, model);
  if (!v.ok) return v;
  return {
    ...model,
    walls: [...model.walls, wall],
  };
}

export type UpdateWallResult = BuildingModel | { ok: false; reason: string };

export function getWallsByFloor(model: BuildingModel, floorId: string): Wall[] {
  return model.walls.filter((w) => w.floorId === floorId);
}

export function updateWallInModel(
  model: BuildingModel,
  wallId: string,
  patch: Partial<
    Pick<
      Wall,
      | 'floorId'
      | 'start'
      | 'end'
      | 'thicknessMm'
      | 'wallType'
      | 'structuralRole'
      | 'panelizationEnabled'
      | 'panelDirection'
      | 'panelTypeId'
      | 'heightMm'
      | 'wallPlacement'
    >
  >
): UpdateWallResult {
  const prev = findWallById(model, wallId);
  if (!prev) {
    return { ok: false, reason: 'Стена не найдена' };
  }

  let m = model;
  if (patch.start !== undefined || patch.end !== undefined) {
    const geo: Partial<Pick<Wall, 'start' | 'end'>> = {};
    if (patch.start !== undefined) geo.start = patch.start;
    if (patch.end !== undefined) geo.end = patch.end;
    const r = applyWallGeometryPatch(m, wallId, geo);
    if ('ok' in r && (r as { ok?: boolean }).ok === false) {
      return r as { ok: false; reason: string };
    }
    m = r as BuildingModel;
  }

  const { start: _ps, end: _pe, ...rest } = patch;
  if (Object.keys(rest).length === 0) {
    const cur = findWallById(m, wallId)!;
    const v = validateWall(cur, m);
    if (!v.ok) return v;
    return m;
  }

  const cur = findWallById(m, wallId)!;
  const next: Wall = {
    ...cur,
    ...rest,
    start: { ...cur.start },
    end: { ...cur.end },
  };
  const v = validateWall(next, m);
  if (!v.ok) return v;
  const walls = m.walls.map((w) => (w.id === wallId ? next : w));
  return { ...m, walls };
}

export function deleteWallFromModel(model: BuildingModel, wallId: string): BuildingModel {
  const withoutLayout = clearWallPanelLayout(model, wallId);
  const next: BuildingModel = {
    ...withoutLayout,
    walls: withoutLayout.walls.filter((w) => w.id !== wallId),
    openings: withoutLayout.openings.filter((o) => o.wallId !== wallId),
  };
  return pruneUnusedWallJoints(next);
}
