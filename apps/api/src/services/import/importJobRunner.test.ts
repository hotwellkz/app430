import { describe, expect, it } from 'vitest';
import {
  AsyncInlineImportJobRunner,
  SyncImportJobRunner,
} from './importJobRunner.js';
import { resolveImportJobRunner } from './resolveImportJobRunner.js';

const queuedJob = {
  id: 'ij-1',
  projectId: 'p1',
  status: 'queued' as const,
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:00:00.000Z',
  createdBy: 'u1',
  importSchemaVersion: 1,
  sourceImages: [{ id: 'img-1', kind: 'plan' as const, fileName: 'plan.png' }],
  snapshot: null,
  errorMessage: null,
};

describe('import job runner', () => {
  it('sync runner executes pipeline immediately', async () => {
    const runner = new SyncImportJobRunner();
    let called = false;
    const res = await runner.execute({
      queuedJob,
      request: { sourceImages: queuedJob.sourceImages },
      runPipeline: async () => {
        called = true;
        return { ...queuedJob, status: 'needs_review' as const };
      },
    });
    expect(called).toBe(true);
    expect(res.status).toBe('needs_review');
  });

  it('async-inline runner schedules separately', async () => {
    let scheduledTask: unknown = null;
    const runner = new AsyncInlineImportJobRunner((task) => {
      scheduledTask = task;
    });
    let called = false;
    const res = await runner.execute({
      queuedJob,
      request: { sourceImages: queuedJob.sourceImages },
      runPipeline: async () => {
        called = true;
        return { ...queuedJob, status: 'needs_review' as const };
      },
    });
    expect(res.status).toBe('queued');
    expect(called).toBe(false);
    expect(scheduledTask).not.toBeNull();
    if (typeof scheduledTask === 'function') {
      await (scheduledTask as () => Promise<void>)();
    }
    expect(called).toBe(true);
  });

  it('resolver selects runner by env mode', () => {
    expect(resolveImportJobRunner({ IMPORT_JOB_EXECUTION_MODE: 'sync' }).mode).toBe('sync');
    expect(resolveImportJobRunner({ IMPORT_JOB_EXECUTION_MODE: 'async-inline' }).mode).toBe(
      'async-inline'
    );
  });
});
