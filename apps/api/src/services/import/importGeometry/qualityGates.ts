import type { BuildingModel, ImportGeometryDiagnostics, ImportGeometryQualityLevel } from '@2wix/shared-types';
import {
  IMPORT_GEOMETRY_PIPELINE_VERSION,
  type NormalizeSnapshotResult,
} from './normalizeArchitecturalSnapshot.js';

const MIN_WALLS_FOR_GOOD = 6;
const MIN_WALLS_FOR_NON_MINIMAL = 3;
/** ~0.5 м² в мм² — ниже считаем вырожденным. */
const MIN_FOOTPRINT_AREA_MM2 = 500_000;

export function bboxAreaMm2(
  b: { minX: number; minY: number; maxX: number; maxY: number } | null
): number {
  if (!b) return 0;
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
}

export function computeImportGeometryQualityLevel(
  model: BuildingModel,
  norm: NormalizeSnapshotResult,
  footprintAreaMm2: number | null,
  extraFallbacks: string[] = []
): ImportGeometryQualityLevel {
  const wallCount = model.walls.length;
  const fp =
    footprintAreaMm2 ??
    (norm.boundingBoxMm ? bboxAreaMm2(norm.boundingBoxMm) : 0);

  const allFb = [...norm.fallbacks, ...extraFallbacks];
  if (allFb.includes('PLACEHOLDER_RECTANGLE_SHELL')) {
    return 'minimal';
  }

  if (wallCount < MIN_WALLS_FOR_NON_MINIMAL || fp < MIN_FOOTPRINT_AREA_MM2) {
    return 'minimal';
  }
  if (allFb.length > 0 || wallCount < MIN_WALLS_FOR_GOOD) {
    return 'degraded';
  }
  return 'good';
}

export function buildGeometryDiagnostics(
  norm: NormalizeSnapshotResult,
  roofIncluded: boolean,
  qualityLevel: ImportGeometryQualityLevel,
  extraFallbacks: string[] = [],
  candidateWallCount?: number
): ImportGeometryDiagnostics {
  return {
    pipelineVersion: IMPORT_GEOMETRY_PIPELINE_VERSION,
    sourceWallSegmentCount: norm.sourceWallSegmentCount,
    sourceOuterContourPointCount: norm.sourceOuterContourPointCount,
    segmentsAfterFilterAndRefine: norm.segmentsAfterFilterAndRefine,
    normalizationWallStrategy: norm.normalizationWallStrategy,
    footprintAreaMm2: norm.footprintAreaMm2,
    boundingBoxMm: norm.boundingBoxMm,
    usedFootprintShell: norm.usedFootprintShell,
    roofIncluded,
    roofSuppressedReason: roofIncluded ? null : norm.roofSuppressedReason,
    qualityLevel,
    fallbacks: [...norm.fallbacks, ...extraFallbacks],
    notes: [...norm.notes],
    geometryReasonCodes: norm.geometryReasonCodes,
    openingsCountIn: norm.openingsCountIn,
    openingsCountOut: norm.openingsCountOut,
    externalWallSegmentsBeforeRescue: norm.externalWallSegmentsBeforeRescue,
    internalWallSegmentsBeforeRescue: norm.internalWallSegmentsBeforeRescue,
    externalWallSegmentsAfterRescue: norm.externalWallSegmentsAfterRescue,
    internalWallSegmentsAfterRescue: norm.internalWallSegmentsAfterRescue,
    rescuePassApplied: norm.rescuePassApplied,
    geometryPipelineStages: norm.geometryPipelineStages,
    strategyExplanation: norm.strategyExplanation,
    outerContourClosed: norm.outerContourClosed,
    candidateWallCount,
  };
}
