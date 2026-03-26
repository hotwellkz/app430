import { FieldValue } from 'firebase-admin/firestore';
import type {
  ArchitecturalImportSnapshot,
  CreateImportJobRequest,
  CreateImportJobResponse,
  ImportJob,
  ImportJobStatus,
  ListImportJobsResponse,
} from '@2wix/shared-types';
import { COLLECTIONS } from '../config/collections.js';
import { NotFoundError, ValidationAppError } from '../errors/httpErrors.js';
import { getDb } from '../firestore/admin.js';
import { mapImportJobDoc } from '../mappers/firestoreMappers.js';
import {
  formatZodError,
  zArchitecturalImportSnapshot,
  zCreateImportJobBody,
} from '../validation/schemas.js';
import { getProject } from './sipProjectService.js';
import type { ArchitecturalExtractorAdapter } from './import/extractorAdapter.js';
import { resolveExtractorAdapter } from './import/resolveExtractorAdapter.js';
import type { ImportJobRunner } from './import/importJobRunner.js';
import { resolveImportJobRunner } from './import/resolveImportJobRunner.js';

export const IMPORT_SCHEMA_VERSION = 1;

interface ImportPipelineDeps {
  resolveAdapter?: () => ArchitecturalExtractorAdapter;
  resolveRunner?: () => ImportJobRunner;
}

function assertStatusTransitionAllowed(
  current: ImportJobStatus,
  next: ImportJobStatus
): void {
  if (current === next) return;
  if (current === 'queued' && (next === 'running' || next === 'failed')) return;
  if (current === 'running' && (next === 'needs_review' || next === 'failed')) return;
  throw new ValidationAppError(`Некорректный переход статуса import-job: ${current} -> ${next}`);
}

export async function createImportJobRecord(
  projectId: string,
  createdBy: string,
  input: CreateImportJobRequest
): Promise<ImportJob> {
  const db = getDb();
  const now = FieldValue.serverTimestamp();
  const ref = db.collection(COLLECTIONS.IMPORT_JOBS).doc();
  await ref.set({
    projectId,
    status: 'queued',
    createdBy,
    createdAt: now,
    updatedAt: now,
    importSchemaVersion: IMPORT_SCHEMA_VERSION,
    sourceImages: input.sourceImages,
    snapshot: null,
    errorMessage: null,
  });
  const created = await ref.get();
  return mapImportJobDoc(ref.id, created.data() ?? {});
}

export async function getImportJobById(jobId: string): Promise<ImportJob> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).get();
  if (!snap.exists) {
    throw new NotFoundError(`Import job не найден: ${jobId}`);
  }
  return mapImportJobDoc(snap.id, snap.data() ?? {});
}

export async function updateImportJobStatus(
  jobId: string,
  nextStatus: Extract<ImportJobStatus, 'queued' | 'running'>
): Promise<ImportJob> {
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, nextStatus);
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: nextStatus,
    // queued/running states should not carry a completed snapshot.
    snapshot: null,
    errorMessage: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function completeImportJobWithSnapshot(
  jobId: string,
  snapshot: ArchitecturalImportSnapshot
): Promise<ImportJob> {
  const snapshotValid = zArchitecturalImportSnapshot.safeParse(snapshot);
  if (!snapshotValid.success) {
    throw new ValidationAppError(
      'Некорректный snapshot от extractor adapter',
      formatZodError(snapshotValid.error)
    );
  }
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, 'needs_review');
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: 'needs_review',
    snapshot: snapshotValid.data,
    errorMessage: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function failImportJob(jobId: string, errorMessage: string): Promise<ImportJob> {
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, 'failed');
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: 'failed',
    snapshot: null,
    errorMessage: errorMessage.trim() || 'Import pipeline failed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function runImportJobPipeline(
  job: ImportJob,
  input: CreateImportJobRequest,
  deps?: ImportPipelineDeps
): Promise<ImportJob> {
  await updateImportJobStatus(job.id, 'running');
  try {
    const adapter = deps?.resolveAdapter?.() ?? resolveExtractorAdapter();
    const snapshot = await adapter.extractArchitecturalSnapshot({
      projectId: job.projectId,
      jobId: job.id,
      sourceImages: input.sourceImages,
      projectName: input.projectName,
    });
    return await completeImportJobWithSnapshot(job.id, snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import pipeline failed';
    return await failImportJob(job.id, message);
  }
}

export async function createImportJob(
  projectId: string,
  body: unknown,
  actorId: string,
  deps?: ImportPipelineDeps
): Promise<CreateImportJobResponse> {
  const parsed = zCreateImportJobBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  await getProject(projectId, actorId);
  const queuedJob = await createImportJobRecord(projectId, actorId, parsed.data);
  const runner = deps?.resolveRunner?.() ?? resolveImportJobRunner();
  const job = await runner.execute({
    queuedJob,
    request: parsed.data,
    runPipeline: (jobForRun, reqForRun) =>
      runImportJobPipeline(jobForRun, reqForRun, {
        resolveAdapter: deps?.resolveAdapter,
      }),
  });
  return { job };
}

export async function getImportJob(
  projectId: string,
  jobId: string,
  actorId: string
): Promise<{ job: ImportJob }> {
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  return { job };
}

export async function listImportJobs(
  projectId: string,
  actorId: string
): Promise<ListImportJobsResponse> {
  await getProject(projectId, actorId);
  const db = getDb();
  const qs = await db
    .collection(COLLECTIONS.IMPORT_JOBS)
    .where('projectId', '==', projectId)
    .limit(100)
    .get();
  const items = qs.docs.map((d) => mapImportJobDoc(d.id, d.data() ?? {}));
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { items };
}
