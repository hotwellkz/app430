import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import {
  boundingBoxMm,
  countWallSegmentsFromSnapshot,
  distanceMm,
  filterWallPolylineShortSegments,
  pointInPolygonMm,
  polygonAreaMm2,
} from './geom2d.js';
import { runGeometryRescuePass, type GeometryRescueMetrics } from './floorPlanGeometryRescue.js';
import { refineArchitecturalSnapshotGeometry } from './floorPlanSnapshotRefine.js';

export const IMPORT_GEOMETRY_PIPELINE_VERSION = 'import-geometry-v4';

/** Первый проход: не отрезать реальные короткие перегородки (раньше 100 мм убивали топологию). */
const MIN_SEGMENT_MM_FIRST = 40;
/** Второй проход, если AI-геометрия «схлопнулась» в ноль при ненулевом сыром числе сегментов. */
const MIN_SEGMENT_MM_LENIENT = 15;

const MIN_FOOTPRINT_AREA_MM2 = 3_000_000;
const MIN_FOOTPRINT_FOR_ROOF_MM2 = 2_000_000;
/** Не строить параметрическую крышу только по «коробке» из footprint shell. */
const MAX_SEGMENTS_FOOTPRINT_SHELL_FOR_ROOF = 6;

export type NormalizationWallStrategy =
  | 'footprint_shell'
  | 'preserve_ai_walls'
  | 'mixed_contour_plus_ai_internals';

export interface GeometryPipelineStageStats {
  minSegmentMmFirstPass: number;
  segmentsAfterShortFilter: number;
  segmentsAfterRefine: number;
  segmentsAfterRescueBeforeShell: number;
  lenientRetryUsed: boolean;
  minSegmentMmLenientPass: number | null;
  segmentsAfterShortFilterAfterLenient: number | null;
  segmentsAfterRefineAfterLenient: number | null;
  segmentsAfterRescueAfterLenient: number | null;
}

export interface NormalizeSnapshotResult {
  snapshot: ArchitecturalImportSnapshot;
  usedFootprintShell: boolean;
  normalizationWallStrategy: NormalizationWallStrategy;
  segmentsAfterFilterAndRefine: number;
  sourceWallSegmentCount: number;
  sourceOuterContourPointCount: number;
  footprintAreaMm2: number | null;
  boundingBoxMm: { minX: number; minY: number; maxX: number; maxY: number } | null;
  fallbacks: string[];
  notes: string[];
  allowParametricRoof: boolean;
  roofSuppressedReason: string | null;
  openingsCountIn: number;
  openingsCountOut: number;
  geometryReasonCodes: string[];
  rescuePassApplied: boolean;
  externalWallSegmentsBeforeRescue: number;
  internalWallSegmentsBeforeRescue: number;
  externalWallSegmentsAfterRescue: number;
  internalWallSegmentsAfterRescue: number;
  geometryPipelineStages: GeometryPipelineStageStats;
  strategyExplanation: string;
  outerContourClosed: boolean;
}

function cloneSnap(s: ArchitecturalImportSnapshot): ArchitecturalImportSnapshot {
  return JSON.parse(JSON.stringify(s)) as ArchitecturalImportSnapshot;
}

function applyShortSegmentFilter(
  snapshot: ArchitecturalImportSnapshot,
  minMm: number
): ArchitecturalImportSnapshot {
  const w = cloneSnap(snapshot);
  w.walls = (w.walls ?? []).map((wall) => ({
    ...wall,
    points: filterWallPolylineShortSegments(wall.points ?? [], minMm),
  }));
  return w;
}

function contourToExternalWalls(
  contour: NonNullable<ArchitecturalImportSnapshot['outerContour']>,
  floorId: string
): ArchitecturalImportSnapshot['walls'] {
  const pts = contour.points;
  if (!Array.isArray(pts) || pts.length < 3) return [];
  const closeLoop = contour.kind === 'polygon' ? 1 : 0;
  const walls: ArchitecturalImportSnapshot['walls'] = [];
  let idx = 0;
  for (let i = 1; i < pts.length + closeLoop; i += 1) {
    const p1 = pts[i - 1]!;
    const p2 = pts[i % pts.length]!;
    if (distanceMm(p1, p2) < MIN_SEGMENT_MM_FIRST) continue;
    idx += 1;
    walls.push({
      id: `norm-outer-${idx}`,
      floorId,
      points: [p1, p2],
      typeHint: 'external',
      thicknessHintMm: 163,
    });
  }
  return walls;
}

function collectInternalWallsInsideContour(
  originalWalls: ArchitecturalImportSnapshot['walls'],
  contourPts: Array<{ x: number; y: number }>,
  floorId: string
): ArchitecturalImportSnapshot['walls'] {
  const out: ArchitecturalImportSnapshot['walls'] = [];
  for (const w of originalWalls) {
    if (w.typeHint !== 'internal') continue;
    const pts = w.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (distanceMm(a, b) < MIN_SEGMENT_MM_FIRST) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (!pointInPolygonMm(mx, my, contourPts)) continue;
      out.push({
        id: `${w.id}-seg-${i}`,
        floorId,
        points: [a, b],
        typeHint: 'internal',
        thicknessHintMm: w.thicknessHintMm ?? 114,
      });
    }
  }
  return out;
}

function collectAllPointsForBbox(snap: ArchitecturalImportSnapshot): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  if (snap.outerContour?.points) pts.push(...snap.outerContour.points);
  for (const w of snap.walls) {
    for (const p of w.points ?? []) pts.push(p);
  }
  return pts;
}

function roofHintAllowsStructure(
  roofHints: ArchitecturalImportSnapshot['roofHints']
): 'gabled' | 'single-slope' | null {
  const t = roofHints?.likelyType;
  if (t === 'gabled' || t === 'single-slope') return t;
  return null;
}

function outerContourIsClosed(oc: ArchitecturalImportSnapshot['outerContour']): boolean {
  if (!oc?.points || oc.points.length < 3) return false;
  return oc.kind === 'polygon';
}

export interface NormalizeReviewContext {
  userConfirmedRoofType?: boolean;
}

function buildStrategyExplanation(
  strategy: NormalizationWallStrategy,
  usedShell: boolean,
  segFinal: number,
  lenientUsed: boolean,
  mixed: boolean
): string {
  if (usedShell) {
    return `footprint_shell: после фильтра/refine/rescue не осталось сегментов AI — построена оболочка по outerContour (${segFinal} сегм.).`;
  }
  if (mixed) {
    return `mixed_contour_plus_ai_internals: к внутренним стенам AI добавлено кольцо внешнего контура (внешние сегменты в данных отсутствовали).`;
  }
  if (lenientUsed) {
    return `preserve_ai_walls: сегменты восстановлены после мягкого порога коротких рёбер (${MIN_SEGMENT_MM_LENIENT} мм); полилинии AI сохранены (${segFinal} сегм.).`;
  }
  return `preserve_ai_walls: сегменты после нормализации без полной подмены контуром (${segFinal} сегм.).`;
}

interface PassResult {
  working: ArchitecturalImportSnapshot;
  segmentsAfterShortFilter: number;
  segmentsAfterRefine: number;
  segmentsAfterRescue: number;
  refinedNotes: string[];
  rescueNotes: string[];
  rescueReasonCodes: string[];
  metrics: GeometryRescueMetrics;
  mixedContourSupplement: boolean;
}

function runFilterRefineRescuePass(
  snapshot: ArchitecturalImportSnapshot,
  floorId: string,
  minSegmentMm: number
): PassResult {
  const filtered = applyShortSegmentFilter(snapshot, minSegmentMm);
  const segmentsAfterShortFilter = countWallSegmentsFromSnapshot(filtered.walls ?? []);
  const refined = refineArchitecturalSnapshotGeometry(filtered);
  const segmentsAfterRefine = countWallSegmentsFromSnapshot(refined.snapshot.walls ?? []);
  const rescue = runGeometryRescuePass(refined.snapshot, floorId);
  const segmentsAfterRescue = countWallSegmentsFromSnapshot(rescue.snapshot.walls ?? []);
  return {
    working: rescue.snapshot,
    segmentsAfterShortFilter,
    segmentsAfterRefine,
    segmentsAfterRescue,
    refinedNotes: refined.notes,
    rescueNotes: rescue.notes,
    rescueReasonCodes: rescue.reasonCodes,
    metrics: rescue.metrics,
    mixedContourSupplement: rescue.mixedContourSupplement,
  };
}

export function normalizeArchitecturalSnapshotForCandidate(
  snapshot: ArchitecturalImportSnapshot,
  reviewContext?: NormalizeReviewContext
): NormalizeSnapshotResult {
  const floorId = snapshot.floors[0]?.id ?? 'floor-1';
  const openingsCountIn = snapshot.openings?.length ?? 0;

  const sourceWallSegmentCount = countWallSegmentsFromSnapshot(snapshot.walls ?? []);
  const oc = snapshot.outerContour;
  const sourceOuterContourPointCount = oc?.points?.length ?? 0;
  let footprintAreaMm2: number | null = null;
  if (oc?.points && oc.points.length >= 3) {
    footprintAreaMm2 = polygonAreaMm2(oc.points);
  }
  const outerContourClosed = outerContourIsClosed(oc ?? null);

  const fallbacks: string[] = [];
  const notes: string[] = [];
  const geometryReasonCodes: string[] = [];

  let pass = runFilterRefineRescuePass(snapshot, floorId, MIN_SEGMENT_MM_FIRST);
  let working = pass.working;
  notes.push(...pass.refinedNotes);
  notes.push(...pass.rescueNotes);
  geometryReasonCodes.push('REFINE_GRID_SIMPLIFY');
  geometryReasonCodes.push(...pass.rescueReasonCodes);

  let segAfterRescue = pass.segmentsAfterRescue;
  let metrics = pass.metrics;
  let mixedFlag = pass.mixedContourSupplement;
  const firstPassSegmentsAfterRescue = pass.segmentsAfterRescue;

  let lenientRetryUsed = false;
  let segmentsAfterShortFilterAfterLenient: number | null = null;
  let segmentsAfterRefineAfterLenient: number | null = null;
  let segmentsAfterRescueAfterLenient: number | null = null;

  if (segAfterRescue === 0 && sourceWallSegmentCount > 0) {
    lenientRetryUsed = true;
    geometryReasonCodes.push('LENIENT_SEGMENT_FILTER_RETRY');
    notes.push(
      `После порога ${MIN_SEGMENT_MM_FIRST} мм сегментов не осталось, хотя в сыром snapshot было ${sourceWallSegmentCount} — повтор с ${MIN_SEGMENT_MM_LENIENT} мм.`
    );
    const passL = runFilterRefineRescuePass(snapshot, floorId, MIN_SEGMENT_MM_LENIENT);
    segmentsAfterShortFilterAfterLenient = passL.segmentsAfterShortFilter;
    segmentsAfterRefineAfterLenient = passL.segmentsAfterRefine;
    segmentsAfterRescueAfterLenient = passL.segmentsAfterRescue;
    working = passL.working;
    notes.push(...passL.refinedNotes);
    notes.push(...passL.rescueNotes);
    geometryReasonCodes.push(...passL.rescueReasonCodes);
    segAfterRescue = passL.segmentsAfterRescue;
    metrics = passL.metrics;
    mixedFlag = passL.mixedContourSupplement;
    if (segAfterRescue > 0) {
      geometryReasonCodes.push('LENIENT_RECOVERY_SUCCESS');
    }
  }

  const rescuePassApplied = true;
  let usedFootprintShell = false;
  let normalizationWallStrategy: NormalizationWallStrategy = mixedFlag
    ? 'mixed_contour_plus_ai_internals'
    : 'preserve_ai_walls';

  if (
    oc?.points &&
    oc.points.length >= 3 &&
    footprintAreaMm2 !== null &&
    footprintAreaMm2 >= MIN_FOOTPRINT_AREA_MM2 &&
    segAfterRescue === 0
  ) {
    const outerWalls = contourToExternalWalls(oc, floorId);
    const internalKeep = collectInternalWallsInsideContour(snapshot.walls ?? [], oc.points, floorId);
    working.walls = [...outerWalls, ...internalKeep];
    usedFootprintShell = true;
    normalizationWallStrategy = 'footprint_shell';
    fallbacks.push('FOOTPRINT_SHELL_NO_AI_SEGMENTS');
    geometryReasonCodes.push('FOOTPRINT_SHELL_NO_SEGMENTS_AFTER_RESCUE');
    notes.push(
      `После refine/rescue (и при необходимости lenient) не осталось сегментов стен — построена оболочка по outerContour (${outerWalls.length} сегм.)`
    );
    if (internalKeep.length > 0) {
      notes.push(`Внутренние стены из исходного AI внутри контура: ${internalKeep.length} сегм.`);
    }
  } else if (segAfterRescue > 0) {
    notes.push(
      `Сохранены сегменты после refine/rescue (${segAfterRescue} шт.); полная подмена контуром не применялась.`
    );
  }

  const openingsCountOut = working.openings?.length ?? 0;
  if (openingsCountIn !== openingsCountOut) {
    notes.push(`OPENINGS: было ${openingsCountIn}, стало ${openingsCountOut} (ожидалось сохранение)`);
    geometryReasonCodes.push('OPENINGS_COUNT_CHANGED');
  }

  const finalSegCount = countWallSegmentsFromSnapshot(working.walls ?? []);
  const strategyExplanation = buildStrategyExplanation(
    normalizationWallStrategy,
    usedFootprintShell,
    finalSegCount,
    lenientRetryUsed,
    mixedFlag
  );

  let allowParametricRoof = false;
  let roofSuppressedReason: string | null = null;
  const roofType = roofHintAllowsStructure(working.roofHints);
  const areaForRoof = footprintAreaMm2 ?? 0;

  const shellTooCrudeForRoof =
    usedFootprintShell &&
    finalSegCount <= MAX_SEGMENTS_FOOTPRINT_SHELL_FOR_ROOF &&
    normalizationWallStrategy === 'footprint_shell';

  if (roofType) {
    if (areaForRoof >= MIN_FOOTPRINT_FOR_ROOF_MM2) {
      const conf = working.roofHints?.confidence?.level;
      if (conf === 'low' && !reviewContext?.userConfirmedRoofType) {
        roofSuppressedReason = 'roof_confidence_low';
        notes.push('Крыша отложена: низкая уверенность roofHints (подтвердите тип в review)');
      } else if (shellTooCrudeForRoof) {
        roofSuppressedReason = 'roof_deferred_footprint_shell_only';
        notes.push(
          'Крыша отложена: геометрия восстановлена только оболочкой контура без детальных AI-стен — параметрическая крыша не строится'
        );
        geometryReasonCodes.push('ROOF_GATING_FOOTPRINT_SHELL_ONLY');
      } else if (finalSegCount < 1) {
        roofSuppressedReason = 'roof_deferred_insufficient_wall_segments';
        notes.push('Крыша отложена: нет сегментов стен в нормализованной геометрии');
        geometryReasonCodes.push('ROOF_GATING_NO_SEGMENTS');
      } else {
        allowParametricRoof = true;
      }
    } else {
      roofSuppressedReason = 'footprint_too_small_for_roof';
      notes.push('Крыша отложена: площадь контура слишком мала для устойчивой параметрики');
    }
  } else if (working.roofHints?.likelyType && working.roofHints.likelyType !== 'unknown') {
    roofSuppressedReason = 'roof_type_not_parametric_mvp';
  }

  const bbox = boundingBoxMm(collectAllPointsForBbox(working));

  const geometryPipelineStages: GeometryPipelineStageStats = {
    minSegmentMmFirstPass: MIN_SEGMENT_MM_FIRST,
    segmentsAfterShortFilter: pass.segmentsAfterShortFilter,
    segmentsAfterRefine: pass.segmentsAfterRefine,
    segmentsAfterRescueBeforeShell: lenientRetryUsed ? firstPassSegmentsAfterRescue : segAfterRescue,
    lenientRetryUsed,
    minSegmentMmLenientPass: lenientRetryUsed ? MIN_SEGMENT_MM_LENIENT : null,
    segmentsAfterShortFilterAfterLenient,
    segmentsAfterRefineAfterLenient,
    segmentsAfterRescueAfterLenient,
  };

  return {
    snapshot: working,
    usedFootprintShell,
    normalizationWallStrategy,
    segmentsAfterFilterAndRefine: finalSegCount,
    sourceWallSegmentCount,
    sourceOuterContourPointCount,
    footprintAreaMm2,
    boundingBoxMm: bbox,
    fallbacks,
    notes,
    allowParametricRoof,
    roofSuppressedReason: allowParametricRoof ? null : roofSuppressedReason,
    openingsCountIn,
    openingsCountOut,
    geometryReasonCodes,
    rescuePassApplied,
    externalWallSegmentsBeforeRescue: metrics.externalSegmentsBefore,
    internalWallSegmentsBeforeRescue: metrics.internalSegmentsBefore,
    externalWallSegmentsAfterRescue: metrics.externalSegmentsFinal,
    internalWallSegmentsAfterRescue: metrics.internalSegmentsFinal,
    geometryPipelineStages,
    strategyExplanation,
    outerContourClosed,
  };
}
