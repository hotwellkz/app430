import type {
  BuildingModel,
  BuildingModelCandidate,
  CandidateTrace,
  CandidateWarning,
  PanelDirection,
  ReviewedArchitecturalSnapshot,
  Roof,
  Wall,
} from '@2wix/shared-types';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import { boundingBoxMm } from './importGeometry/geom2d.js';
import { normalizeArchitecturalSnapshotForCandidate } from './importGeometry/normalizeArchitecturalSnapshot.js';
import {
  buildGeometryDiagnostics,
  computeImportGeometryQualityLevel,
} from './importGeometry/qualityGates.js';

export const IMPORT_CANDIDATE_MAPPER_VERSION = 'import-candidate-v2';

interface BuildCandidateOptions {
  importJobId: string;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function createEmptyCandidateModel(name: string): BuildingModel {
  const m = createEmptyBuildingModel();
  m.meta.id = `candidate-${Date.now()}`;
  m.meta.name = name?.trim() ? name : m.meta.name;
  m.settings.defaultWallThicknessMm = 163;
  return m;
}

/** Fallback для панелизации: горизонталь/вертикаль по доминирующей оси сегмента. */
function inferPanelDirectionForSegment(
  start: { x: number; y: number },
  end: { x: number; y: number }
): PanelDirection {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx >= dy ? 'horizontal' : 'vertical';
}

/** Направление конька: перпендикулярно более длинной стороне bbox стен (детерминировано). */
function ridgeDirectionFromWallExtents(walls: Wall[]): 'x' | 'y' {
  const pts: Array<{ x: number; y: number }> = [];
  for (const w of walls) {
    pts.push(w.start, w.end);
  }
  const bb = boundingBoxMm(pts);
  if (!bb) return 'x';
  const wx = bb.maxX - bb.minX;
  const wy = bb.maxY - bb.minY;
  return wx >= wy ? 'y' : 'x';
}

const PLACEHOLDER_SIDE_MM = 10_000;

function appendPlaceholderRectangleShell(
  model: BuildingModel,
  trace: CandidateTrace[],
  wallIdx: { n: number }
): void {
  const floorId = model.floors[0]!.id;
  const L = PLACEHOLDER_SIDE_MM;
  const seg: Array<[Wall['start'], Wall['end']]> = [
    [{ x: 0, y: 0 }, { x: L, y: 0 }],
    [{ x: L, y: 0 }, { x: L, y: L }],
    [{ x: L, y: L }, { x: 0, y: L }],
    [{ x: 0, y: L }, { x: 0, y: 0 }],
  ];
  for (const [start, end] of seg) {
    const wallId = `w-${wallIdx.n++}`;
    model.walls.push({
      id: wallId,
      floorId,
      start,
      end,
      thicknessMm: 163,
      wallType: 'external',
      structuralRole: 'bearing',
      panelDirection: inferPanelDirectionForSegment(start, end),
    });
    trace.push({
      sourceType: 'outer_contour',
      sourceId: 'placeholder-shell',
      targetType: 'wall',
      targetId: wallId,
      rule: 'placeholder-rectangle-fallback',
    });
  }
}

export function buildBuildingModelCandidateFromReviewedSnapshot(
  reviewed: ReviewedArchitecturalSnapshot,
  options: BuildCandidateOptions
): BuildingModelCandidate {
  const norm = normalizeArchitecturalSnapshotForCandidate(reviewed.transformedSnapshot, {
    userConfirmedRoofType: Boolean(reviewed.appliedDecisions?.roofTypeConfirmed),
  });
  const source = norm.snapshot;

  const warnings: CandidateWarning[] = [];
  const trace: CandidateTrace[] = [];
  const model = createEmptyCandidateModel(source.projectMeta.name ?? 'Imported candidate');
  const floorIdMap = new Map<string, string>();
  const extraFallbacks: string[] = [];

  for (let i = 0; i < source.floors.length; i += 1) {
    const sf = source.floors[i]!;
    const floorId = `f-${i + 1}`;
    floorIdMap.set(sf.id, floorId);
    model.floors.push({
      id: floorId,
      label: sf.label ?? `Floor ${i + 1}`,
      level: i + 1,
      elevationMm: sf.elevationHintMm ?? i * 3000,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: i,
    });
    trace.push({
      sourceType: 'floor',
      sourceId: sf.id,
      targetType: 'floor',
      targetId: floorId,
      rule: 'floor-basic-mapping',
    });
  }
  if (model.floors.length === 0) {
    model.floors.push({
      id: 'f-1',
      label: 'Floor 1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    warnings.push({
      code: 'FLOORS_EMPTY_FALLBACK',
      severity: 'warning',
      message: 'Floors not found in reviewed snapshot, fallback floor created',
      sourceType: 'floor',
      sourceId: null,
    });
  }

  const wallBySourceId = new Map<string, string[]>();
  let wallIdx = 1;
  for (const sw of source.walls) {
    const floorId = floorIdMap.get(sw.floorId) ?? model.floors[0]!.id;
    const mappedIds: string[] = [];
    if (!Array.isArray(sw.points) || sw.points.length < 2) {
      warnings.push({
        code: 'WALL_POINTS_INVALID',
        severity: 'warning',
        message: 'Wall skipped: not enough points',
        sourceType: 'wall',
        sourceId: sw.id,
      });
      continue;
    }
    for (let i = 1; i < sw.points.length; i += 1) {
      const p1 = sw.points[i - 1]!;
      const p2 = sw.points[i]!;
      if (distance(p1, p2) < 1) {
        warnings.push({
          code: 'WALL_SEGMENT_TOO_SHORT',
          severity: 'warning',
          message: 'Wall segment skipped: too short',
          sourceType: 'wall',
          sourceId: sw.id,
        });
        continue;
      }
      const wallId = `w-${wallIdx++}`;
      const start = { x: p1.x, y: p1.y };
      const end = { x: p2.x, y: p2.y };
      const wall: Wall = {
        id: wallId,
        floorId,
        start,
        end,
        thicknessMm: sw.thicknessHintMm ?? 163,
        wallType: sw.typeHint ?? 'external',
        structuralRole: sw.typeHint === 'internal' ? 'partition' : 'bearing',
        panelDirection: inferPanelDirectionForSegment(start, end),
      };
      model.walls.push(wall);
      mappedIds.push(wallId);
      trace.push({
        sourceType: 'wall',
        sourceId: sw.id,
        targetType: 'wall',
        targetId: wallId,
        rule: 'wall-polyline-segment-mapping',
      });
    }
    wallBySourceId.set(sw.id, mappedIds);
  }

  if (model.walls.length === 0 && source.outerContour?.points?.length) {
    const pts = source.outerContour.points;
    const closeLoop = source.outerContour.kind === 'polygon' ? 1 : 0;
    for (let i = 1; i < pts.length + closeLoop; i += 1) {
      const p1 = pts[i - 1]!;
      const p2 = pts[i % pts.length]!;
      if (distance(p1, p2) < 1) continue;
      const wallId = `w-${wallIdx++}`;
      const start = { x: p1.x, y: p1.y };
      const end = { x: p2.x, y: p2.y };
      model.walls.push({
        id: wallId,
        floorId: model.floors[0]!.id,
        start,
        end,
        thicknessMm: 163,
        wallType: 'external',
        structuralRole: 'bearing',
        panelDirection: inferPanelDirectionForSegment(start, end),
      });
      trace.push({
        sourceType: 'outer_contour',
        sourceId: 'outer-contour',
        targetType: 'wall',
        targetId: wallId,
        rule: 'outer-contour-fallback-mapping',
      });
    }
  }

  if (model.walls.length === 0) {
    extraFallbacks.push('PLACEHOLDER_RECTANGLE_SHELL');
    appendPlaceholderRectangleShell(model, trace, { n: wallIdx });
    warnings.push({
      code: 'PLACEHOLDER_RECTANGLE_SHELL',
      severity: 'warning',
      message:
        'Из плана не удалось построить стены; добавлен детерминированный прямоугольный черновик 10×10 м для дальнейшей правки.',
      sourceType: 'outer_contour',
      sourceId: 'placeholder-shell',
    });
  }

  let openingIdx = 1;
  for (const so of source.openings) {
    const floorId = floorIdMap.get(so.floorId) ?? model.floors[0]!.id;
    let targetWallId: string | null = null;
    if (so.wallId) {
      const mappedWallIds = wallBySourceId.get(so.wallId);
      targetWallId = mappedWallIds?.[0] ?? null;
    }
    if (!targetWallId) {
      const fallback = model.walls.find((w) => w.floorId === floorId) ?? model.walls[0];
      targetWallId = fallback?.id ?? null;
      warnings.push({
        code: 'OPENING_WALL_LINK_FALLBACK',
        severity: 'warning',
        message: 'Opening wall link fallback was applied',
        sourceType: 'opening',
        sourceId: so.id,
      });
    }
    if (!targetWallId) {
      warnings.push({
        code: 'OPENING_SKIPPED_NO_WALLS',
        severity: 'warning',
        message: 'Opening skipped: no candidate walls available',
        sourceType: 'opening',
        sourceId: so.id,
      });
      continue;
    }
    const openingId = `o-${openingIdx++}`;
    model.openings.push({
      id: openingId,
      floorId,
      wallId: targetWallId,
      openingType: so.type === 'door' ? 'door' : so.type === 'window' ? 'window' : 'portal',
      positionAlongWall: so.positionAlongWallMm ?? 500,
      widthMm: so.widthMm ?? 900,
      heightMm: so.heightMm ?? 2100,
      bottomOffsetMm: 0,
    });
    trace.push({
      sourceType: 'opening',
      sourceId: so.id,
      targetType: 'opening',
      targetId: openingId,
      rule: 'opening-basic-mapping',
    });
  }

  let roofIncluded = false;
  const ridgeDir = ridgeDirectionFromWallExtents(model.walls);
  if (norm.allowParametricRoof) {
    const rt = source.roofHints?.likelyType;
    if (rt === 'gabled' || rt === 'single-slope') {
      const roof: Roof = {
        id: 'r-1',
        floorId: model.floors[model.floors.length - 1]!.id,
        roofType: rt === 'gabled' ? 'gable' : 'single_slope',
        slopeDegrees: 25,
        ridgeDirection: ridgeDir,
        overhangMm: 300,
        baseElevationMm: model.floors[model.floors.length - 1]!.elevationMm + 2800,
        generationMode: 'auto',
      };
      model.roofs.push(roof);
      roofIncluded = true;
      trace.push({
        sourceType: 'roof',
        sourceId: 'roof-hints',
        targetType: 'roof',
        targetId: roof.id,
        rule: 'roof-hints-to-parametric-roof-mapping',
      });
    }
  } else if (source.roofHints?.likelyType && source.roofHints.likelyType !== 'unknown') {
    warnings.push({
      code: 'ROOF_SUPPRESSED',
      severity: 'warning',
      message: `Крыша не построена: ${norm.roofSuppressedReason ?? 'недостаточно данных контура/уверенности'}`,
      sourceType: 'roof',
      sourceId: 'roof-hints',
      details: { reason: norm.roofSuppressedReason },
    });
  }

  for (const s of source.stairs) {
    warnings.push({
      code: 'STAIR_NOT_MAPPED_YET',
      severity: 'warning',
      message: 'Stairs are not mapped to candidate model yet',
      sourceType: 'stair',
      sourceId: s.id,
    });
  }
  for (const issue of source.unresolved) {
    warnings.push({
      code: 'UNRESOLVED_IMPORT_ISSUE',
      severity: issue.severity === 'blocking' ? 'error' : 'warning',
      message: issue.message,
      sourceType: 'issue',
      sourceId: issue.id,
      details: { issueCode: issue.code },
    });
  }

  const qualityLevel = computeImportGeometryQualityLevel(
    model,
    norm,
    norm.footprintAreaMm2,
    extraFallbacks
  );
  const geometryDiagnostics = buildGeometryDiagnostics(
    norm,
    roofIncluded,
    qualityLevel,
    extraFallbacks,
    model.walls.length
  );

  if (qualityLevel !== 'good') {
    warnings.push({
      code: 'IMPORT_CANDIDATE_QUALITY_BELOW_EXPECTATIONS',
      severity: qualityLevel === 'minimal' ? 'warning' : 'info',
      message:
        qualityLevel === 'minimal'
          ? 'Из плана извлечена только частичная геометрия; построен упрощённый или неполный черновик. Сверьте с планом и доработайте вручную.'
          : 'Геометрия кандидата приблизительная (fallback/упрощения). Рекомендуется проверка размеров и стен.',
      sourceType: 'issue',
      sourceId: 'quality-gate',
      details: { qualityLevel, fallbacks: geometryDiagnostics.fallbacks },
    });
  }

  const hasError = warnings.some((w) => w.severity === 'error');
  const status =
    hasError || qualityLevel !== 'good' ? 'partial' : 'ready';

  return {
    model,
    warnings,
    trace,
    mapperVersion: IMPORT_CANDIDATE_MAPPER_VERSION,
    generatedAt: new Date().toISOString(),
    basedOnImportJobId: options.importJobId,
    basedOnReviewedSnapshotVersion: reviewed.generatedAt,
    status,
    geometryDiagnostics,
  };
}
