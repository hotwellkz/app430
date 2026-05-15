import type {
  KaspiParseJob,
  KaspiParseJobStatus,
} from '@2wix/shared-types';
import { parseJobsCol } from './collections.js';

function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateParseJobInput {
  productId: string;
  companyId: string;
  scheduledAt?: string;
}

export async function createParseJob(
  input: CreateParseJobInput,
): Promise<KaspiParseJob> {
  const ref = parseJobsCol().doc();
  const job: KaspiParseJob = {
    id: ref.id,
    productId: input.productId,
    companyId: input.companyId,
    status: 'pending',
    attempts: 0,
    lastError: null,
    scheduledAt: input.scheduledAt ?? nowIso(),
    startedAt: null,
    finishedAt: null,
  };
  await ref.set(job);
  return job;
}

export async function getParseJob(id: string): Promise<KaspiParseJob | null> {
  const snap = await parseJobsCol().doc(id).get();
  return snap.exists ? (snap.data() as KaspiParseJob) : null;
}

export interface UpdateParseJobPatch {
  status?: KaspiParseJobStatus;
  attempts?: number;
  lastError?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export async function updateParseJob(
  id: string,
  patch: UpdateParseJobPatch,
): Promise<KaspiParseJob | null> {
  const ref = parseJobsCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update(patch);
  const next = await ref.get();
  return next.data() as KaspiParseJob;
}

/** Выбрать очередную пачку pending-задач (используется воркером в шаге 4). */
export async function pickPendingJobs(
  limit = 20,
): Promise<KaspiParseJob[]> {
  const snap = await parseJobsCol()
    .where('status', '==', 'pending')
    .orderBy('scheduledAt', 'asc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as KaspiParseJob);
}
