import type { BuildingModel, FoundationStrip, GroundScreed, Wall } from '@2wix/shared-types';
import {
  DEFAULT_FOUNDATION_HEIGHT_MM,
  DEFAULT_FOUNDATION_INNER_OFFSET_MM,
  DEFAULT_FOUNDATION_OUTER_OFFSET_MM,
  DEFAULT_FOUNDATION_WIDTH_MM,
  DEFAULT_SCREED_THICKNESS_MM,
} from './foundationConstants.js';
import { orderExternalWallsInRing, isExternalWallForFoundation } from './foundationOuterWallLoop.js';
import { buildFoundationContours } from './foundationStripBuild.js';
import { computeExternalWallSignatureForFloor } from './foundationSignature.js';
import { newDomainId } from './ids.js';
import { getWallsByFloor } from './wallOps.js';

export interface CreateFoundationParams {
  widthMm?: number;
  heightMm?: number;
  outerOffsetMm?: number;
  innerOffsetMm?: number;
  screedThicknessMm?: number;
}

export type FoundationBuildResult =
  | { ok: true; foundation: FoundationStrip; screed: GroundScreed }
  | { ok: false; reason: string };

export function buildFoundationAndScreedForFloor(
  model: BuildingModel,
  floorId: string,
  params: CreateFoundationParams = {}
): FoundationBuildResult {
  const widthMm = params.widthMm ?? DEFAULT_FOUNDATION_WIDTH_MM;
  const heightMm = params.heightMm ?? DEFAULT_FOUNDATION_HEIGHT_MM;
  const outerOffsetMm = params.outerOffsetMm ?? DEFAULT_FOUNDATION_OUTER_OFFSET_MM;
  const innerOffsetMm = params.innerOffsetMm ?? DEFAULT_FOUNDATION_INNER_OFFSET_MM;
  const screedThicknessMm = params.screedThicknessMm ?? DEFAULT_SCREED_THICKNESS_MM;

  if (widthMm <= 0 || heightMm <= 0 || screedThicknessMm <= 0) {
    return { ok: false, reason: 'Ширина, высота фундамента и толщина стяжки должны быть > 0' };
  }

  const floorWalls = getWallsByFloor(model, floorId);
  const external = floorWalls.filter((w) => isExternalWallForFoundation(w));
  if (external.length < 3) {
    return { ok: false, reason: 'Нужно минимум три наружные стены для контура' };
  }

  const ring = orderExternalWallsInRing(external);
  if (!ring.ok) {
    return { ok: false, reason: ring.reason };
  }

  const byId = new Map(floorWalls.map((w) => [w.id, w]));
  const ordered: Wall[] = ring.ids.map((id) => byId.get(id)).filter((w): w is Wall => Boolean(w));
  if (ordered.length !== ring.ids.length) {
    return { ok: false, reason: 'Не найдены стены контура' };
  }

  const contours = buildFoundationContours(ordered, {
    outerOffsetMm,
    widthMm,
    innerOffsetExtraMm: innerOffsetMm,
  });
  if (!contours.ok) {
    return { ok: false, reason: contours.reason };
  }

  const signature = computeExternalWallSignatureForFloor(model.walls, floorId);
  const foundationId = newDomainId();
  const screedId = newDomainId();

  const foundation: FoundationStrip = {
    id: foundationId,
    floorId,
    kind: 'strip',
    basedOnWallIds: [...ring.ids],
    outerContourMm: contours.outer,
    innerContourMm: contours.inner,
    widthMm,
    heightMm,
    outerOffsetMm,
    innerOffsetMm,
    sourceWallSignature: signature,
    needsRecompute: false,
  };

  const screed: GroundScreed = {
    id: screedId,
    floorId,
    foundationId,
    contourMm: contours.inner.map((p) => ({ ...p })),
    thicknessMm: screedThicknessMm,
    needsRecompute: false,
  };

  return { ok: true, foundation, screed };
}

export function upsertFoundationInModel(
  model: BuildingModel,
  foundation: FoundationStrip,
  screed: GroundScreed
): BuildingModel {
  const foundations = [...(model.foundations ?? [])];
  const groundScreeds = [...(model.groundScreeds ?? [])];
  const fi = foundations.findIndex((f) => f.floorId === foundation.floorId);
  if (fi >= 0) {
    foundations[fi] = foundation;
  } else {
    foundations.push(foundation);
  }
  const si = groundScreeds.findIndex((s) => s.floorId === screed.floorId);
  if (si >= 0) {
    groundScreeds[si] = screed;
  } else {
    groundScreeds.push(screed);
  }
  return { ...model, foundations, groundScreeds };
}

export function deleteFoundationForFloor(model: BuildingModel, floorId: string): BuildingModel {
  return {
    ...model,
    foundations: (model.foundations ?? []).filter((f) => f.floorId !== floorId),
    groundScreeds: (model.groundScreeds ?? []).filter((s) => s.floorId !== floorId),
  };
}

export function findFoundationByFloor(model: BuildingModel, floorId: string): FoundationStrip | undefined {
  return (model.foundations ?? []).find((f) => f.floorId === floorId);
}

export function findGroundScreedByFloor(model: BuildingModel, floorId: string): GroundScreed | undefined {
  return (model.groundScreeds ?? []).find((s) => s.floorId === floorId);
}

export function updateFoundationInModel(
  model: BuildingModel,
  foundationId: string,
  patch: Partial<
    Pick<
      FoundationStrip,
      | 'widthMm'
      | 'heightMm'
      | 'outerOffsetMm'
      | 'innerOffsetMm'
      | 'outerContourMm'
      | 'innerContourMm'
      | 'basedOnWallIds'
      | 'sourceWallSignature'
      | 'needsRecompute'
    >
  >
): BuildingModel {
  const foundations = (model.foundations ?? []).map((f) =>
    f.id === foundationId ? { ...f, ...patch } : f
  );
  return { ...model, foundations };
}

export function updateGroundScreedInModel(
  model: BuildingModel,
  screedId: string,
  patch: Partial<Pick<GroundScreed, 'contourMm' | 'thicknessMm' | 'needsRecompute'>>
): BuildingModel {
  const groundScreeds = (model.groundScreeds ?? []).map((s) =>
    s.id === screedId ? { ...s, ...patch } : s
  );
  return { ...model, groundScreeds };
}

export function recomputeFoundationById(model: BuildingModel, foundationId: string): FoundationBuildResult {
  const f = (model.foundations ?? []).find((x) => x.id === foundationId);
  if (!f) {
    return { ok: false, reason: 'Фундамент не найден' };
  }
  const existingScreed = (model.groundScreeds ?? []).find((s) => s.foundationId === f.id);
  const built = buildFoundationAndScreedForFloor(model, f.floorId, {
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    outerOffsetMm: f.outerOffsetMm,
    innerOffsetMm: f.innerOffsetMm,
    screedThicknessMm: existingScreed?.thicknessMm,
  });
  if (!built.ok) return built;
  return {
    ok: true,
    foundation: {
      ...built.foundation,
      id: f.id,
      metadata: f.metadata,
    },
    screed: {
      ...built.screed,
      id: existingScreed?.id ?? built.screed.id,
      foundationId: f.id,
      metadata: existingScreed?.metadata,
    },
  };
}

export function deleteFoundationById(model: BuildingModel, foundationId: string): BuildingModel {
  const f = (model.foundations ?? []).find((x) => x.id === foundationId);
  if (!f) return model;
  return {
    ...model,
    foundations: (model.foundations ?? []).filter((x) => x.id !== foundationId),
    groundScreeds: (model.groundScreeds ?? []).filter((s) => s.foundationId !== foundationId),
  };
}
