import { FieldValue } from 'firebase-admin/firestore';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from '@2wix/spec-engine';
import { buildExportPackage } from '@2wix/export-engine';
import type {
  CreateExportResponse,
  ExportArtifactMeta,
  ExportPackageSnapshot,
  ExportFormat,
} from '@2wix/shared-types';
import { assertActorMatchesHeader, assertCanAccessProject } from '../access/projectAccess.js';
import { COLLECTIONS } from '../config/collections.js';
import { NotFoundError, ValidationAppError } from '../errors/httpErrors.js';
import { getDb } from '../firestore/admin.js';
import { mapExportDoc, mapProjectDoc } from '../mappers/firestoreMappers.js';
import { formatZodError, zCreateExportBody } from '../validation/schemas.js';
import { getCurrentVersion, getProject } from './sipProjectService.js';

function makeFileName(projectId: string, versionNumber: number, format: ExportFormat): string {
  return `sip-${projectId.slice(0, 8)}-v${versionNumber}.${format}`;
}

export async function createProjectExport(
  projectId: string,
  body: unknown,
  actorId: string
): Promise<CreateExportResponse> {
  const parsed = zCreateExportBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  assertActorMatchesHeader(parsed.data.createdBy, actorId);
  const project = await getProject(projectId, actorId);
  const version = await getCurrentVersion(projectId, actorId);
  if (!version) throw new NotFoundError('Текущая версия проекта не найдена');

  const panelization = buildPanelizationSnapshot(version.buildingModel);
  const spec = buildSpecSnapshot(version.buildingModel, panelization);
  const snapshot = buildExportPackage(version.buildingModel, panelization, spec, {
    projectTitle: project.title,
    version: { id: version.id, versionNumber: version.versionNumber },
    createdBy: actorId,
  });

  const db = getDb();
  const ref = db.collection(COLLECTIONS.PROJECT_EXPORTS).doc();
  const now = FieldValue.serverTimestamp();
  const fileName = makeFileName(projectId, version.versionNumber, parsed.data.format);
  await ref.set({
    projectId,
    versionId: version.id,
    format: parsed.data.format,
    title: parsed.data.title ?? `Export ${parsed.data.format.toUpperCase()} v${version.versionNumber}`,
    createdAt: now,
    createdBy: actorId,
    status: 'ready',
    fileName,
    storagePath: null,
    errorMessage: null,
    snapshot,
  });
  const created = await ref.get();
  return {
    artifact: mapExportDoc(ref.id, created.data() ?? {}),
    snapshot: (created.data()?.snapshot as ExportPackageSnapshot) ?? snapshot,
  };
}

export async function listProjectExports(
  projectId: string,
  actorId: string,
  limitCount = 50
): Promise<ExportArtifactMeta[]> {
  await getProject(projectId, actorId);
  const db = getDb();
  const qs = await db
    .collection(COLLECTIONS.PROJECT_EXPORTS)
    .where('projectId', '==', projectId)
    .limit(Math.max(1, Math.min(100, limitCount)))
    .get();
  const rows = qs.docs.map((d) => mapExportDoc(d.id, d.data() ?? {}));
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows;
}

export async function getProjectExport(
  projectId: string,
  exportId: string,
  actorId: string
): Promise<{ artifact: ExportArtifactMeta; snapshot: ExportPackageSnapshot | null }> {
  const db = getDb();
  const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!projectSnap.exists) throw new NotFoundError(`Проект не найден: ${projectId}`);
  const project = mapProjectDoc(projectSnap.id, projectSnap.data() ?? {});
  assertCanAccessProject(project, actorId);
  const snap = await db.collection(COLLECTIONS.PROJECT_EXPORTS).doc(exportId).get();
  if (!snap.exists) throw new NotFoundError(`Экспорт не найден: ${exportId}`);
  const data = snap.data() ?? {};
  if (data.projectId !== projectId) {
    throw new NotFoundError(`Экспорт не найден в проекте: ${exportId}`);
  }
  return {
    artifact: mapExportDoc(exportId, data),
    snapshot: (data.snapshot as ExportPackageSnapshot | undefined) ?? null,
  };
}
