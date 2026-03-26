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

export const zCreateProjectBody = z.object({
  dealId: z.string().nullable().optional(),
  title: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(128),
  allowedEditorIds: z.array(z.string().min(1)).max(64).optional(),
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

export const zImportAssetRef = z.object({
  id: z.string().min(1),
  kind: z.enum(['plan', 'facade', 'other']),
  fileName: z.string().min(1),
  mimeType: z.string().min(1).optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  storagePath: z.string().min(1).optional(),
  fileUrl: z.string().min(1).optional(),
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

export function formatZodError(err: z.ZodError): unknown {
  return err.flatten();
}
