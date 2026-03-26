import { FieldValue } from 'firebase-admin/firestore';
import type {
  ArchitecturalImportSnapshot,
  CreateImportJobResponse,
  ImportJob,
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

export const IMPORT_SCHEMA_VERSION = 1;

export function createMockArchitecturalImportSnapshot(input?: {
  projectName?: string;
}): ArchitecturalImportSnapshot {
  return {
    projectMeta: {
      ...(input?.projectName ? { name: input.projectName } : {}),
      detectedScaleHints: [],
      notes: ['mock import snapshot generated without AI extractor'],
    },
    floors: [
      {
        id: 'floor-1',
        label: 'Floor 1 (mock)',
        elevationHintMm: null,
        confidence: {
          score: 0.2,
          level: 'low',
        },
      },
    ],
    outerContour: null,
    walls: [],
    openings: [],
    stairs: [],
    roofHints: {
      likelyType: 'unknown',
      confidence: { score: 0.1, level: 'low' },
      notes: ['Extractor is not connected yet'],
    },
    dimensions: [],
    unresolved: [
      {
        id: 'mock-extractor-not-connected',
        code: 'EXTRACTOR_NOT_CONNECTED',
        severity: 'blocking',
        message: 'AI extractor not connected yet. Review/confirmation required.',
        requiredAction: 'Подключить extractor и выполнить импорт повторно',
        relatedIds: [],
      },
    ],
    notes: ['mock import snapshot generated without AI extractor'],
  };
}

export async function createImportJob(
  projectId: string,
  body: unknown,
  actorId: string
): Promise<CreateImportJobResponse> {
  const parsed = zCreateImportJobBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  await getProject(projectId, actorId);
  const snapshot = createMockArchitecturalImportSnapshot({
    projectName: parsed.data.projectName,
  });
  const snapshotValid = zArchitecturalImportSnapshot.safeParse(snapshot);
  if (!snapshotValid.success) {
    throw new ValidationAppError(
      'Не удалось создать mock snapshot',
      formatZodError(snapshotValid.error)
    );
  }
  const db = getDb();
  const now = FieldValue.serverTimestamp();
  const ref = db.collection(COLLECTIONS.IMPORT_JOBS).doc();
  await ref.set({
    projectId,
    status: 'needs_review',
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    importSchemaVersion: IMPORT_SCHEMA_VERSION,
    sourceImages: parsed.data.sourceImages,
    snapshot: snapshotValid.data,
    errorMessage: null,
  });
  const created = await ref.get();
  return { job: mapImportJobDoc(ref.id, created.data() ?? {}) };
}

export async function getImportJob(
  projectId: string,
  jobId: string,
  actorId: string
): Promise<{ job: ImportJob }> {
  await getProject(projectId, actorId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).get();
  if (!snap.exists) {
    throw new NotFoundError(`Import job не найден: ${jobId}`);
  }
  const job = mapImportJobDoc(snap.id, snap.data() ?? {});
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
