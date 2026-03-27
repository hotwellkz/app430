import type { ImportJob } from '@2wix/shared-types';

export type ImportJobPollStatus = 'ready' | 'failed' | 'timeout';

export interface GetImportJobFn {
  (projectId: string, jobId: string): Promise<{ job: ImportJob }>;
}

/**
 * Ожидает завершения pipeline: needs_review + snapshot или failed.
 */
export async function waitForImportJobReviewable(
  projectId: string,
  jobId: string,
  getImportJob: GetImportJobFn,
  options: { maxMs?: number; intervalMs?: number } = {}
): Promise<ImportJobPollStatus> {
  const maxMs = options.maxMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 400;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { job } = await getImportJob(projectId, jobId);
    if (job.status === 'needs_review' && job.snapshot) return 'ready';
    if (job.status === 'failed') return 'failed';
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return 'timeout';
}
