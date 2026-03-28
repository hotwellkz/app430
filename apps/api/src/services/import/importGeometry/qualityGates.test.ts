import { describe, expect, it } from 'vitest';
import type { BuildingModel } from '@2wix/shared-types';
import { computeImportGeometryQualityLevel } from './qualityGates.js';
import type { NormalizeSnapshotResult } from './normalizeArchitecturalSnapshot.js';

function emptyNorm(over: Partial<NormalizeSnapshotResult> = {}): NormalizeSnapshotResult {
  return {
    snapshot: {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    usedFootprintShell: false,
    normalizationWallStrategy: 'preserve_ai_walls',
    segmentsAfterFilterAndRefine: 0,
    sourceWallSegmentCount: 0,
    sourceOuterContourPointCount: 0,
    footprintAreaMm2: null,
    boundingBoxMm: null,
    fallbacks: [],
    notes: [],
    allowParametricRoof: false,
    roofSuppressedReason: null,
    openingsCountIn: 0,
    openingsCountOut: 0,
    geometryReasonCodes: [],
    rescuePassApplied: false,
    externalWallSegmentsBeforeRescue: 0,
    internalWallSegmentsBeforeRescue: 0,
    externalWallSegmentsAfterRescue: 0,
    internalWallSegmentsAfterRescue: 0,
    geometryPipelineStages: {
      minSegmentMmFirstPass: 40,
      segmentsAfterShortFilter: 0,
      segmentsAfterRefine: 0,
      segmentsAfterRescueBeforeShell: 0,
      lenientRetryUsed: false,
      minSegmentMmLenientPass: null,
      segmentsAfterShortFilterAfterLenient: null,
      segmentsAfterRefineAfterLenient: null,
      segmentsAfterRescueAfterLenient: null,
    },
    strategyExplanation: '',
    outerContourClosed: false,
    ...over,
  };
}

describe('computeImportGeometryQualityLevel', () => {
  it('minimal при placeholder fallback', () => {
    const model: BuildingModel = {
      meta: { id: 'm', name: 'x' },
      settings: { units: 'mm', defaultWallThicknessMm: 163, gridStepMm: 100 },
      floors: [{ id: 'f1', label: '1', level: 1, elevationMm: 0, heightMm: 2800, floorType: 'full', sortIndex: 0 }],
      walls: [],
      openings: [],
      slabs: [],
      roofs: [],
      panelLibrary: [],
      panelSettings: {
        defaultPanelTypeId: null,
        allowTrimmedPanels: true,
        minTrimWidthMm: 250,
        preferFullPanels: true,
        labelPrefixWall: 'W',
        labelPrefixRoof: 'R',
        labelPrefixSlab: 'S',
      },
    };
    const q = computeImportGeometryQualityLevel(model, emptyNorm(), null, ['PLACEHOLDER_RECTANGLE_SHELL']);
    expect(q).toBe('minimal');
  });
});
