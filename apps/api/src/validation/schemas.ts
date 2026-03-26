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

export function formatZodError(err: z.ZodError): unknown {
  return err.flatten();
}
