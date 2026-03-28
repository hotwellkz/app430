import { z } from 'zod';
import { BUILDING_MODEL_SCHEMA_VERSION } from '@2wix/shared-types';

/** Минимальная структура buildingModel; детальная нормализация — в domain-model. */
export const zBuildingModelPayload = z
  .object({
    meta: z
      .object({
        id: z.string().min(1),
        name: z.string(),
      })
      .passthrough(),
    settings: z.record(z.unknown()),
    floors: z.array(z.unknown()),
    walls: z.array(z.unknown()),
    openings: z.array(z.unknown()),
    slabs: z.array(z.unknown()),
    roofs: z.array(z.unknown()),
    panelLibrary: z.array(z.unknown()),
    panelSettings: z.record(z.unknown()),
  })
  .strict();

export const zVersionImportProvenance = z.object({
  sourceKind: z.literal('ai_import'),
  importJobId: z.string().min(1),
  mapperVersion: z.string().min(1),
  reviewedSnapshotVersion: z.string().min(1),
  appliedBy: z.string().min(1),
  appliedAt: z.string().min(1),
  warningsCount: z.number().int().min(0),
  traceCount: z.number().int().min(0),
  note: z.string().nullable().optional(),
});

export const zCreateProjectBody = z.object({
  dealId: z.string().nullable().optional(),
  title: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(128),
  allowedEditorIds: z.array(z.string().min(1)).max(64).optional(),
  isTemplate: z.boolean().optional(),
});

export const zDuplicateProjectBody = z.object({
  title: z.string().min(1).max(500),
  createdBy: z.string().min(1).max(128),
  markAsTemplate: z.boolean().optional(),
});

export const zPatchProjectBody = z
  .object({
    updatedBy: z.string().min(1).max(128),
    title: z.string().max(500).optional(),
    isTemplate: z.boolean().optional(),
  })
  .refine((d) => d.title !== undefined || d.isTemplate !== undefined, {
    message: 'Укажите title и/или isTemplate',
  });

export const zPatchCurrentBody = z.object({
  buildingModel: zBuildingModelPayload,
  updatedBy: z.string().min(1).max(128),
  expectedCurrentVersionId: z.string().min(1),
  expectedVersionNumber: z.number().int().positive(),
  expectedSchemaVersion: z.number().int().min(1).max(BUILDING_MODEL_SCHEMA_VERSION + 5),
});

export const zCreateVersionBody = z.object({
  createdBy: z.string().min(1).max(128),
  basedOnVersionId: z.string().min(1).nullable().optional(),
  mode: z.enum(['clone-current', 'from-version']).optional().default('clone-current'),
});

export const zCreateExportBody = z.object({
  createdBy: z.string().min(1).max(128),
  format: z.enum(['pdf', 'csv', 'xlsx']),
  presentationMode: z.enum(['technical', 'commercial']).optional().default('technical'),
  title: z.string().max(200).optional(),
  retryOfExportId: z.string().min(1).optional(),
});

const zPoint = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const zImportConfidence = z.object({
  score: z.number().min(0).max(1),
  level: z.enum(['high', 'medium', 'low']),
});

export const zImportUnresolvedIssue = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  severity: z.enum(['warning', 'blocking']),
  message: z.string().min(1),
  requiredAction: z.string().min(1).optional(),
  relatedIds: z.array(z.string().min(1)).optional(),
});

export const zImportIssueResolution = z.object({
  issueId: z.string().min(1),
  action: z.enum(['confirm', 'exclude', 'override', 'manual']),
  note: z.string().max(1000).optional(),
});

export const zImportUserDecisionSet = z
  .object({
    floorHeightsMmByFloorId: z.record(z.string(), z.number().finite().positive()).optional(),
    roofTypeConfirmed: z.enum(['gabled', 'single-slope', 'unknown']).optional(),
    internalBearingWalls: z
      .object({
        confirmed: z.boolean(),
        wallIds: z.array(z.string().min(1)),
      })
      .strict()
      .optional(),
    scale: z
      .object({
        mode: z.enum(['confirmed', 'override']),
        mmPerPixel: z.number().finite().positive().nullable().optional(),
      })
      .strict()
      .optional(),
    issueResolutions: z.array(zImportIssueResolution).optional(),
  })
  .strict();

export const zImportAssetRef = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['plan', 'facade', 'other']),
    fileName: z.string().min(1),
    mimeType: z.string().min(1).optional(),
    widthPx: z.number().int().positive().optional(),
    heightPx: z.number().int().positive().optional(),
    storageProvider: z.enum(['firebase']).optional(),
    bucket: z.string().min(1).optional(),
    storagePath: z.string().min(1).optional(),
    sizeBytes: z.number().int().positive().optional(),
    checksumSha256: z.string().min(16).optional(),
    fileUrl: z.string().min(1).optional(),
    base64Data: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasBase64 = typeof data.base64Data === 'string' && data.base64Data.length > 0;
    const hasFirebaseStorage =
      data.storageProvider === 'firebase' &&
      typeof data.storagePath === 'string' &&
      data.storagePath.length > 0;
    if (!hasBase64 && !hasFirebaseStorage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Каждое изображение: укажите base64Data или storageProvider=firebase с storagePath',
      });
    }
  });

export const zArchitecturalImportSnapshot = z.object({
  projectMeta: z
    .object({
      name: z.string().min(1).optional(),
      detectedScaleHints: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional(),
    })
    .strict(),
  floors: z.array(
    z
      .object({
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        elevationHintMm: z.number().finite().nullable().optional(),
        confidence: zImportConfidence.optional(),
      })
      .strict()
  ),
  outerContour: z
    .object({
      kind: z.enum(['polygon', 'polyline']),
      points: z.array(zPoint),
      confidence: zImportConfidence.optional(),
    })
    .strict()
    .nullable()
    .optional(),
  walls: z.array(
    z
      .object({
        id: z.string().min(1),
        floorId: z.string().min(1),
        points: z.array(zPoint),
        typeHint: z.enum(['external', 'internal']).optional(),
        thicknessHintMm: z.number().finite().nullable().optional(),
        confidence: zImportConfidence.optional(),
      })
      .strict()
  ),
  openings: z.array(
    z
      .object({
        id: z.string().min(1),
        floorId: z.string().min(1),
        wallId: z.string().min(1).nullable().optional(),
        type: z.enum(['window', 'door', 'unknown']).optional(),
        positionAlongWallMm: z.number().finite().nullable().optional(),
        widthMm: z.number().finite().nullable().optional(),
        heightMm: z.number().finite().nullable().optional(),
        confidence: zImportConfidence.optional(),
      })
      .strict()
  ),
  stairs: z.array(
    z
      .object({
        id: z.string().min(1),
        floorId: z.string().min(1),
        polygon: z.array(zPoint).optional(),
        directionHint: z.enum(['up', 'down', 'unknown']).optional(),
        confidence: zImportConfidence.optional(),
      })
      .strict()
  ),
  roofHints: z
    .object({
      likelyType: z.enum(['gabled', 'single-slope', 'unknown']).optional(),
      confidence: zImportConfidence.optional(),
      notes: z.array(z.string()).optional(),
    })
    .strict()
    .nullable()
    .optional(),
  dimensions: z
    .array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().optional(),
          valueMm: z.number().finite().nullable().optional(),
          confidence: zImportConfidence.optional(),
        })
        .strict()
    )
    .optional(),
  unresolved: z.array(zImportUnresolvedIssue),
  notes: z.array(z.string()),
});

export const zCreateImportJobBody = z.object({
  sourceImages: z.array(zImportAssetRef).min(1).max(50),
  projectName: z.string().min(1).max(300).optional(),
});

export const zImportRequiredDecision = z.object({
  code: z.enum([
    'FLOOR_HEIGHTS_REQUIRED',
    'ROOF_TYPE_CONFIRMATION_REQUIRED',
    'INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED',
    'INTERNAL_BEARING_WALL_IDS_REQUIRED',
    'INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE',
    'SCALE_DECISION_REQUIRED',
    'SCALE_OVERRIDE_VALUE_REQUIRED',
    'BLOCKING_ISSUES_RESOLUTION_REQUIRED',
  ]),
  message: z.string().min(1),
  satisfied: z.boolean(),
});

export const zReviewedArchitecturalSnapshot = z.object({
  baseSnapshot: zArchitecturalImportSnapshot,
  transformedSnapshot: zArchitecturalImportSnapshot,
  appliedDecisions: zImportUserDecisionSet,
  resolvedIssueIds: z.array(z.string().min(1)),
  notes: z.array(z.string()),
  generatedAt: z.string().min(1),
});

export const zCandidateWarning = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string().min(1),
  sourceType: z.enum([
    'floor',
    'wall',
    'opening',
    'stair',
    'roof',
    'outer_contour',
    'dimension',
    'issue',
  ]),
  sourceId: z.string().nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

export const zCandidateTrace = z.object({
  sourceType: z.enum([
    'floor',
    'wall',
    'opening',
    'stair',
    'roof',
    'outer_contour',
    'dimension',
    'issue',
  ]),
  sourceId: z.string().min(1),
  targetType: z.enum(['floor', 'wall', 'opening', 'slab', 'roof', 'meta']),
  targetId: z.string().min(1),
  rule: z.string().min(1),
  notes: z.array(z.string()).optional(),
});

export const zImportGeometryDiagnostics = z.object({
  pipelineVersion: z.string().min(1),
  sourceWallSegmentCount: z.number().int().min(0),
  sourceOuterContourPointCount: z.number().int().min(0),
  segmentsAfterFilterAndRefine: z.number().int().min(0).optional(),
  normalizationWallStrategy: z
    .enum(['footprint_shell', 'preserve_ai_walls', 'mixed_contour_plus_ai_internals'])
    .optional(),
  footprintAreaMm2: z.number().nullable(),
  boundingBoxMm: z
    .object({
      minX: z.number(),
      minY: z.number(),
      maxX: z.number(),
      maxY: z.number(),
    })
    .nullable(),
  usedFootprintShell: z.boolean(),
  roofIncluded: z.boolean(),
  roofSuppressedReason: z.string().nullable(),
  qualityLevel: z.enum(['good', 'degraded', 'minimal']),
  fallbacks: z.array(z.string()),
  notes: z.array(z.string()),
  geometryReasonCodes: z.array(z.string()).optional(),
  openingsCountIn: z.number().int().min(0).optional(),
  openingsCountOut: z.number().int().min(0).optional(),
  externalWallSegmentsBeforeRescue: z.number().int().min(0).optional(),
  internalWallSegmentsBeforeRescue: z.number().int().min(0).optional(),
  externalWallSegmentsAfterRescue: z.number().int().min(0).optional(),
  internalWallSegmentsAfterRescue: z.number().int().min(0).optional(),
  rescuePassApplied: z.boolean().optional(),
  geometryPipelineStages: z
    .object({
      minSegmentMmFirstPass: z.number(),
      segmentsAfterShortFilter: z.number(),
      segmentsAfterRefine: z.number(),
      segmentsAfterRescueBeforeShell: z.number(),
      lenientRetryUsed: z.boolean(),
      minSegmentMmLenientPass: z.number().nullable(),
      segmentsAfterShortFilterAfterLenient: z.number().nullable(),
      segmentsAfterRefineAfterLenient: z.number().nullable(),
      segmentsAfterRescueAfterLenient: z.number().nullable(),
    })
    .optional(),
  strategyExplanation: z.string().optional(),
  outerContourClosed: z.boolean().optional(),
  candidateWallCount: z.number().int().min(0).optional(),
});

export const zBuildingModelCandidate = z.object({
  model: zBuildingModelPayload,
  warnings: z.array(zCandidateWarning),
  trace: z.array(zCandidateTrace),
  mapperVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  basedOnImportJobId: z.string().min(1),
  basedOnReviewedSnapshotVersion: z.string().min(1),
  status: z.enum(['partial', 'ready']).optional(),
  geometryDiagnostics: zImportGeometryDiagnostics.optional(),
});

export const zImportEditorApplyState = z.object({
  status: z.enum(['draft', 'candidate_ready', 'failed']),
  candidate: zBuildingModelCandidate.optional(),
  errorMessage: z.string().nullable().optional(),
  generatedAt: z.string().nullable().optional(),
  generatedBy: z.string().nullable().optional(),
  mapperVersion: z.string().nullable().optional(),
});

export const zCandidateApplySummary = z.object({
  createdOrUpdatedVersionId: z.string().min(1),
  appliedObjectCounts: z.object({
    floors: z.number().int().min(0),
    walls: z.number().int().min(0),
    openings: z.number().int().min(0),
    slabs: z.number().int().min(0),
    roofs: z.number().int().min(0),
  }),
  warningsCount: z.number().int().min(0),
  traceCount: z.number().int().min(0),
  basedOnImportJobId: z.string().min(1),
  basedOnMapperVersion: z.string().min(1),
  basedOnReviewedSnapshotVersion: z.string().min(1),
});

export const zImportProjectApplyState = z.object({
  status: z.enum(['draft', 'applied', 'failed']),
  appliedAt: z.string().nullable().optional(),
  appliedBy: z.string().nullable().optional(),
  appliedVersionId: z.string().nullable().optional(),
  appliedVersionNumber: z.number().int().positive().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  summary: zCandidateApplySummary.nullable().optional(),
});

export const zImportReviewState = z.object({
  status: z.enum(['draft', 'complete', 'applied']),
  applyStatus: z.enum(['not_ready', 'ready', 'applied']),
  decisions: zImportUserDecisionSet,
  missingRequiredDecisions: z.array(zImportRequiredDecision),
  remainingBlockingIssueIds: z.array(z.string().min(1)),
  isReadyToApply: z.boolean(),
  reviewedSnapshot: zReviewedArchitecturalSnapshot.nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  appliedAt: z.string().nullable().optional(),
  appliedBy: z.string().nullable().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
  lastUpdatedBy: z.string().nullable().optional(),
});

export const zSaveImportReviewBody = z.object({
  updatedBy: z.string().min(1).max(128),
  decisions: zImportUserDecisionSet.partial(),
});

export const zApplyImportReviewBody = z.object({
  appliedBy: z.string().min(1).max(128),
});

export const zPrepareEditorApplyBody = z.object({
  generatedBy: z.string().min(1).max(128),
});

export const zApplyCandidateToProjectBody = z.object({
  appliedBy: z.string().min(1).max(128),
  expectedCurrentVersionId: z.string().min(1),
  expectedVersionNumber: z.number().int().positive(),
  expectedSchemaVersion: z.number().int().min(1).max(BUILDING_MODEL_SCHEMA_VERSION + 5),
  note: z.string().max(2000).optional(),
});

export const zImportJob = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  status: z.enum(['queued', 'running', 'needs_review', 'failed']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().min(1),
  importSchemaVersion: z.number().int().positive(),
  sourceImages: z.array(zImportAssetRef),
  snapshot: zArchitecturalImportSnapshot.nullable(),
  review: zImportReviewState.optional(),
  editorApply: zImportEditorApplyState.optional(),
  projectApply: zImportProjectApplyState.optional(),
  errorMessage: z.string().nullable().optional(),
});

export const zCreateImportJobResponse = z.object({
  job: zImportJob,
});

export const zGetImportJobResponse = z.object({
  job: zImportJob,
});

export const zListImportJobsResponse = z.object({
  items: z.array(zImportJob),
});

export const zSaveImportReviewResponse = z.object({
  job: zImportJob,
});

export const zApplyImportReviewResponse = z.object({
  job: zImportJob,
  reviewedSnapshot: zReviewedArchitecturalSnapshot,
});

export const zPrepareEditorApplyResponse = z.object({
  job: zImportJob,
  candidate: zBuildingModelCandidate,
});

export const zApplyCandidateToProjectResponse = z.object({
  job: zImportJob,
  appliedVersionMeta: z.object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.string().min(1),
  }),
  applySummary: zCandidateApplySummary,
});

export const zImportApplyHistoryItem = z.object({
  versionId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  sourceKind: z.literal('ai_import'),
  importJobId: z.string().min(1),
  mapperVersion: z.string().min(1),
  reviewedSnapshotVersion: z.string().min(1),
  appliedBy: z.string().min(1),
  appliedAt: z.string().min(1),
  warningsCount: z.number().int().min(0),
  traceCount: z.number().int().min(0),
  note: z.string().nullable().optional(),
  isLegacy: z.boolean().optional(),
  isIncomplete: z.boolean().optional(),
  missingFields: z.array(z.string().min(1)).optional(),
});

export const zGetImportApplyHistoryResponse = z.object({
  items: z.array(zImportApplyHistoryItem),
});

export function formatZodError(err: z.ZodError): unknown {
  return err.flatten();
}
