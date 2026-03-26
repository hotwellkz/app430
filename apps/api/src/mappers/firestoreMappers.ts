import type { DocumentData, Timestamp } from 'firebase-admin/firestore';
import type {
  ArchitecturalImportSnapshot,
  BuildingModel,
  ImportJob,
  ImportJobStatus,
  ExportArtifactMeta,
  ExportFormat,
  ExportPresentationMode,
  ExportStatus,
  Project,
  ProjectStatus,
  ProjectVersion,
} from '@2wix/shared-types';
import { BUILDING_MODEL_SCHEMA_VERSION } from '@2wix/shared-types';
import { zArchitecturalImportSnapshot } from '../validation/schemas.js';

function tsToIso(v: Timestamp | { toDate?: () => Date } | Date | string | undefined): string {
  if (v === undefined || v === null) {
    return new Date().toISOString();
  }
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof (v as Timestamp).toDate === 'function') {
    return (v as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function mapProjectDoc(id: string, data: DocumentData): Project {
  const status = data.status as ProjectStatus | undefined;
  const safeStatus: ProjectStatus =
    status === 'calculated' || status === 'reviewed' || status === 'approved'
      ? status
      : 'draft';

  const currentVersionId =
    typeof data.currentVersionId === 'string' ? data.currentVersionId : null;

  const currentVersionNumberRaw = data.currentVersionNumber;
  const currentVersionNumber =
    typeof currentVersionNumberRaw === 'number'
      ? currentVersionNumberRaw
      : currentVersionId
        ? num(data.versionCounter, 1)
        : null;

  const allowedRaw = data.allowedEditorIds;
  const allowedEditorIds = Array.isArray(allowedRaw)
    ? allowedRaw.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined;

  return {
    id,
    dealId: typeof data.dealId === 'string' ? data.dealId : data.dealId ?? null,
    title: typeof data.title === 'string' ? data.title : 'SIP-проект',
    status: safeStatus,
    currentVersionId,
    currentVersionNumber,
    schemaVersion: num(data.schemaVersion, BUILDING_MODEL_SCHEMA_VERSION),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
    allowedEditorIds: allowedEditorIds && allowedEditorIds.length > 0 ? allowedEditorIds : undefined,
    lastCalculatedAt:
      data.lastCalculatedAt === null || data.lastCalculatedAt === undefined
        ? null
        : tsToIso(data.lastCalculatedAt as Timestamp),
  };
}

export function mapVersionDoc(
  id: string,
  data: DocumentData,
  buildingModel: BuildingModel
): ProjectVersion {
  return {
    id,
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    versionNumber: num(data.versionNumber, 1),
    schemaVersion: num(data.schemaVersion, BUILDING_MODEL_SCHEMA_VERSION),
    buildingModel,
    createdAt: tsToIso(data.createdAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
    basedOnVersionId:
      typeof data.basedOnVersionId === 'string' ? data.basedOnVersionId : null,
    isSnapshot: data.isSnapshot === true,
  };
}

export function mapExportDoc(id: string, data: DocumentData): ExportArtifactMeta {
  const status = data.status as ExportStatus | undefined;
  const safeStatus: ExportStatus =
    status === 'pending' || status === 'failed' ? status : 'ready';
  const format = data.format as ExportFormat | undefined;
  const safeFormat: ExportFormat =
    format === 'pdf' || format === 'xlsx' ? format : 'csv';
  const mode = data.presentationMode as ExportPresentationMode | undefined;
  const safeMode: ExportPresentationMode = mode === 'commercial' ? 'commercial' : 'technical';
  return {
    id,
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    versionId: typeof data.versionId === 'string' ? data.versionId : '',
    format: safeFormat,
    presentationMode: safeMode,
    title: typeof data.title === 'string' ? data.title : `Export ${safeFormat.toUpperCase()}`,
    createdAt: tsToIso(data.createdAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
    status: safeStatus,
    fileName: typeof data.fileName === 'string' ? data.fileName : `export.${safeFormat}`,
    storagePath: typeof data.storagePath === 'string' ? data.storagePath : null,
    fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : null,
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : null,
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : null,
    errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : null,
    retryCount: typeof data.retryCount === 'number' ? data.retryCount : 0,
    completedAt: data.completedAt ? tsToIso(data.completedAt as Timestamp) : null,
  };
}

export function mapImportJobDoc(id: string, data: DocumentData): ImportJob {
  const status = data.status as ImportJobStatus | undefined;
  const safeStatus: ImportJobStatus =
    status === 'queued' || status === 'running' || status === 'failed' ? status : 'needs_review';
  const snapshotParsed = zArchitecturalImportSnapshot.safeParse(data.snapshot);
  const snapshot: ArchitecturalImportSnapshot | null = snapshotParsed.success
    ? snapshotParsed.data
    : null;
  return {
    id,
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    status: safeStatus,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    importSchemaVersion:
      typeof data.importSchemaVersion === 'number' ? data.importSchemaVersion : 1,
    sourceImages: Array.isArray(data.sourceImages)
      ? data.sourceImages.filter((x): x is ImportJob['sourceImages'][number] => {
          return (
            typeof x === 'object' &&
            x !== null &&
            typeof (x as { id?: unknown }).id === 'string' &&
            typeof (x as { kind?: unknown }).kind === 'string' &&
            typeof (x as { fileName?: unknown }).fileName === 'string'
          );
        })
      : [],
    snapshot,
    errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : null,
  };
}
