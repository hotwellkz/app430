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
import { getDb, getStorageBucket } from '../firestore/admin.js';
import { mapExportDoc, mapProjectDoc } from '../mappers/firestoreMappers.js';
import { formatZodError, zCreateExportBody } from '../validation/schemas.js';
import { getCurrentVersion, getProject } from './sipProjectService.js';
import { renderExportBinary } from './exportBinaryRenderer.js';

function makeFileName(projectId: string, versionNumber: number, format: ExportFormat): string {
  return `sip-${projectId.slice(0, 8)}-v${versionNumber}.${format}`;
}

const EXPORT_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Export timeout exceeded')), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
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
  let retryCount = 0;
  if (parsed.data.retryOfExportId) {
    const prev = await db.collection(COLLECTIONS.PROJECT_EXPORTS).doc(parsed.data.retryOfExportId).get();
    const prevRetry = typeof prev.data()?.retryCount === 'number' ? prev.data()?.retryCount : 0;
    retryCount = prevRetry + 1;
  }
  await ref.set({
    projectId,
    versionId: version.id,
    format: parsed.data.format,
    title: parsed.data.title ?? `Export ${parsed.data.format.toUpperCase()} v${version.versionNumber}`,
    createdAt: now,
    createdBy: actorId,
    status: 'pending',
    fileName,
    storagePath: null,
    fileUrl: null,
    sizeBytes: null,
    mimeType: null,
    errorMessage: null,
    retryCount,
    completedAt: null,
    snapshot,
  });
  try {
    const { rendered, storagePath, url } = await withTimeout(
      (async () => {
        const rendered = await renderExportBinary(snapshot, parsed.data.format);
        const storagePath = `sip-exports/${projectId}/${version.id}/${ref.id}/${fileName}`;
        const bucket = getStorageBucket();
        const file = bucket.file(storagePath);
        await file.save(rendered.buffer, {
          resumable: false,
          metadata: {
            contentType: rendered.mimeType,
          },
        });
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 1000 * 60 * 60 * 24,
        });
        return { rendered, storagePath, url };
      })(),
      EXPORT_TIMEOUT_MS
    );
    await ref.update({
      status: 'ready',
      storagePath,
      fileUrl: url,
      sizeBytes: rendered.buffer.byteLength,
      mimeType: rendered.mimeType,
      completedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await ref.update({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'export failed',
      completedAt: FieldValue.serverTimestamp(),
    });
  }
  const created = await ref.get();
  const artifact = mapExportDoc(ref.id, created.data() ?? {});
  return { artifact, snapshot };
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
  for (const row of rows) {
    if (row.status === 'ready' && row.storagePath) {
      try {
        const [url] = await getStorageBucket().file(row.storagePath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 1000 * 60 * 30,
        });
        row.fileUrl = url;
      } catch {
        row.fileUrl = null;
      }
    }
  }
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
  const artifact = mapExportDoc(exportId, data);
  if (artifact.status === 'ready' && artifact.storagePath) {
    try {
      const [url] = await getStorageBucket().file(artifact.storagePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 30,
      });
      artifact.fileUrl = url;
    } catch {
      artifact.fileUrl = null;
    }
  }
  return {
    artifact,
    snapshot: (data.snapshot as ExportPackageSnapshot | undefined) ?? null,
  };
}

export async function getProjectExportDownloadUrl(
  projectId: string,
  exportId: string,
  actorId: string
): Promise<{ url: string; fileName: string }> {
  const result = await getProjectExport(projectId, exportId, actorId);
  if (result.artifact.status !== 'ready' || !result.artifact.storagePath) {
    throw new ValidationAppError('Экспорт ещё не готов или отсутствует в storage');
  }
  const [url] = await getStorageBucket().file(result.artifact.storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 1000 * 60 * 30,
  });
  return { url, fileName: result.artifact.fileName };
}
