import type { BuildingModel, Slab, SlabAssemblyKind } from '@2wix/shared-types';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';
import { newDomainId } from './ids.js';
import { getFloorById } from './modelUtils.js';
import { buildSlabDeckContourFromExternalWalls } from './slabContourBuild.js';
import { createSlab, inferSlabTypeForFloor } from './slabOps.js';

export const DEFAULT_SLAB_ELEVATION_OFFSET_MM = 0;

export type SlabAssemblyBuildResult =
  | { ok: true; slab: Slab }
  | { ok: false; reason: string };

export interface BuildSlabAssemblyParams {
  thicknessMm?: number;
  assemblyKind?: SlabAssemblyKind;
  /** Нижняя грань плиты, мм (абсолютная отметка). Если не задано — по верху этажа. */
  elevationMm?: number;
}

function defaultBottomElevationMm(model: BuildingModel, floorId: string, thicknessMm: number): number {
  const floor = getFloorById(model, floorId);
  if (!floor) return 0;
  const st = inferSlabTypeForFloor(model, floorId);
  if (st === 'ground') {
    return floor.elevationMm;
  }
  return floor.elevationMm + floor.heightMm - thicknessMm;
}

/**
 * Собирает перекрытие по наружному контуру этажа (одна плита на этаж в MVP).
 */
export function buildSlabAssemblyForFloor(
  model: BuildingModel,
  floorId: string,
  params: BuildSlabAssemblyParams = {}
): SlabAssemblyBuildResult {
  const thicknessMm = params.thicknessMm ?? 220;
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) {
    return { ok: false, reason: 'Толщина перекрытия должна быть > 0' };
  }

  const contour = buildSlabDeckContourFromExternalWalls(model, floorId);
  if (!contour.ok) {
    return { ok: false, reason: contour.reason };
  }

  const signature = computeExternalWallSignatureForFloor(model.walls, floorId);
  const assemblyKind: SlabAssemblyKind = params.assemblyKind ?? 'floor_slab';
  const elevationMm =
    params.elevationMm !== undefined && Number.isFinite(params.elevationMm)
      ? params.elevationMm
      : defaultBottomElevationMm(model, floorId, thicknessMm);

  const slabType = inferSlabTypeForFloor(model, floorId);

  const slab: Slab = {
    id: newDomainId(),
    floorId,
    slabType,
    contourWallIds: [...contour.basedOnWallIds],
    basedOnWallIds: [...contour.basedOnWallIds],
    direction: 'x',
    thicknessMm,
    generationMode: 'auto',
    contourMm: contour.contourMm.map((p) => ({ ...p })),
    assemblyKind,
    sourceWallSignature: signature,
    needsRecompute: false,
    elevationMm,
  };

  return { ok: true, slab };
}

export function recomputeSlabById(model: BuildingModel, slabId: string): SlabAssemblyBuildResult {
  const prev = model.slabs.find((s) => s.id === slabId);
  if (!prev) {
    return { ok: false, reason: 'Перекрытие не найдено' };
  }
  const built = buildSlabAssemblyForFloor(model, prev.floorId, {
    thicknessMm: prev.thicknessMm,
    assemblyKind: prev.assemblyKind,
    elevationMm: prev.elevationMm,
  });
  if (!built.ok) {
    return built;
  }
  return {
    ok: true,
    slab: {
      ...built.slab,
      id: prev.id,
      generationMode: prev.generationMode,
      panelizationEnabled: prev.panelizationEnabled,
      panelTypeId: prev.panelTypeId,
      metadata: prev.metadata,
      structuralHints: prev.structuralHints,
    },
  };
}
