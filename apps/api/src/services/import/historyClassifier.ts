import type { ImportApplyHistoryItem } from '@2wix/shared-types';
import { zVersionImportProvenance } from '../../validation/schemas.js';

const REQUIRED_PROVENANCE_FIELDS = [
  'importJobId',
  'mapperVersion',
  'reviewedSnapshotVersion',
  'appliedBy',
  'appliedAt',
  'warningsCount',
  'traceCount',
] as const;

export interface ClassifyImportHistoryInput {
  versionId: string;
  versionNumberRaw: unknown;
  importProvenanceRaw: unknown;
  nowIso?: () => string;
}

export interface ClassifyImportHistoryResult {
  item: ImportApplyHistoryItem | null;
  isLegacyDetected: boolean;
}

function normalizeVersionNumber(versionNumberRaw: unknown): number {
  return typeof versionNumberRaw === 'number' && Number.isFinite(versionNumberRaw) ? versionNumberRaw : 1;
}

export function classifyImportApplyHistoryVersion(
  input: ClassifyImportHistoryInput
): ClassifyImportHistoryResult {
  const parsed = zVersionImportProvenance.safeParse(input.importProvenanceRaw);
  if (parsed.success) {
    return {
      isLegacyDetected: false,
      item: {
        versionId: input.versionId,
        versionNumber: normalizeVersionNumber(input.versionNumberRaw),
        sourceKind: 'ai_import',
        importJobId: parsed.data.importJobId,
        mapperVersion: parsed.data.mapperVersion,
        reviewedSnapshotVersion: parsed.data.reviewedSnapshotVersion,
        appliedBy: parsed.data.appliedBy,
        appliedAt: parsed.data.appliedAt,
        warningsCount: parsed.data.warningsCount,
        traceCount: parsed.data.traceCount,
        note: parsed.data.note ?? null,
      },
    };
  }

  const raw =
    input.importProvenanceRaw && typeof input.importProvenanceRaw === 'object'
      ? (input.importProvenanceRaw as Record<string, unknown>)
      : null;
  if (!raw || raw.sourceKind !== 'ai_import') {
    return { item: null, isLegacyDetected: false };
  }

  const missingFields: string[] = [];
  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }

  return {
    isLegacyDetected: true,
    item: {
      versionId: input.versionId,
      versionNumber: normalizeVersionNumber(input.versionNumberRaw),
      sourceKind: 'ai_import',
      importJobId: typeof raw.importJobId === 'string' ? raw.importJobId : 'unknown',
      mapperVersion: typeof raw.mapperVersion === 'string' ? raw.mapperVersion : 'unknown',
      reviewedSnapshotVersion:
        typeof raw.reviewedSnapshotVersion === 'string' ? raw.reviewedSnapshotVersion : 'unknown',
      appliedBy: typeof raw.appliedBy === 'string' ? raw.appliedBy : 'unknown',
      appliedAt: typeof raw.appliedAt === 'string' ? raw.appliedAt : (input.nowIso?.() ?? new Date().toISOString()),
      warningsCount:
        typeof raw.warningsCount === 'number' && Number.isFinite(raw.warningsCount)
          ? raw.warningsCount
          : 0,
      traceCount:
        typeof raw.traceCount === 'number' && Number.isFinite(raw.traceCount) ? raw.traceCount : 0,
      note: typeof raw.note === 'string' ? raw.note : null,
      isLegacy: true,
      isIncomplete: missingFields.length > 0,
      missingFields,
    },
  };
}
