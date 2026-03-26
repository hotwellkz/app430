import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, Record<string, any>>();

function resetStore() {
  store.clear();
  store.set('sipEditor_importJobs/ij-older', {
    projectId: 'p1',
    status: 'queued',
    createdBy: 'u1',
    createdAt: '2026-03-25T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    importSchemaVersion: 1,
    sourceImages: [{ id: 'img-old', kind: 'plan', fileName: 'old.png' }],
    snapshot: null,
    errorMessage: null,
  });
  store.set('sipEditor_importJobs/ij-newer', {
    projectId: 'p1',
    status: 'running',
    createdBy: 'u1',
    createdAt: '2026-03-26T10:00:00.000Z',
    updatedAt: '2026-03-26T10:00:00.000Z',
    importSchemaVersion: 1,
    sourceImages: [{ id: 'img-new', kind: 'facade', fileName: 'new.png' }],
    snapshot: null,
    errorMessage: null,
  });
}

vi.mock('../firestore/admin.js', () => ({
  getDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? `ij-created`;
        const key = `${name}/${docId}`;
        return {
          id: docId,
          async set(payload: Record<string, unknown>) {
            const nowIso = new Date('2026-03-26T12:00:00.000Z').toISOString();
            store.set(key, {
              ...payload,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          },
          async get() {
            const data = store.get(key);
            return {
              id: docId,
              exists: Boolean(data),
              data: () => data ?? {},
            };
          },
          async update(payload: Record<string, unknown>) {
            const prev = store.get(key) ?? {};
            const nowIso = new Date('2026-03-26T12:00:00.000Z').toISOString();
            store.set(key, {
              ...prev,
              ...payload,
              updatedAt: nowIso,
            });
          },
        };
      },
      where: (_field: string, _op: string, value: string) => ({
        limit: (_n: number) => ({
          async get() {
            const docs = [...store.entries()]
              .filter(([k, v]) => k.startsWith(`${name}/`) && v.projectId === value)
              .map(([k, v]) => ({
                id: k.split('/')[1],
                data: () => v,
              }));
            return { docs };
          },
        }),
      }),
    }),
  }),
}));

vi.mock('./sipProjectService.js', () => ({
  getProject: vi.fn(async (projectId: string) => ({
    id: projectId,
  })),
}));

import {
  completeImportJobWithSnapshot,
  createImportJob,
  createImportJobRecord,
  failImportJob,
  getImportJobById,
  listImportJobs,
  runImportJobPipeline,
  updateImportJobStatus,
} from './importJobService.js';
import { createMockArchitecturalImportSnapshot } from './import/mockExtractorAdapter.js';
import { AsyncInlineImportJobRunner } from './import/importJobRunner.js';

describe('importJobService', () => {
  beforeEach(() => {
    resetStore();
  });

  it('pipeline: queued -> running -> needs_review', async () => {
    const res = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        projectName: 'My Project',
      },
      'u1'
    );
    expect(res.job.status).toBe('needs_review');
    expect(res.job.sourceImages).toHaveLength(1);
    expect(res.job.snapshot?.floors[0]?.id).toBe('floor-1');
    expect(res.job.snapshot?.projectMeta.name).toBe('My Project');
    expect(res.job.errorMessage).toBeNull();
  });

  it('createImportJob in async-inline mode returns early job and updates later', async () => {
    let deferredTask: unknown = null;
    const res = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        projectName: 'Async Demo',
      },
      'u1',
      {
        resolveRunner: () =>
          new AsyncInlineImportJobRunner((task) => {
            deferredTask = task;
          }),
      }
    );
    expect(res.job.status).toBe('queued');
    expect(res.job.snapshot).toBeNull();

    if (typeof deferredTask === 'function') {
      await (deferredTask as () => Promise<void>)();
    }
    const updated = await getImportJobById(res.job.id);
    expect(updated.status).toBe('needs_review');
    expect(updated.snapshot?.projectMeta.name).toBe('Async Demo');
  });

  it('pipeline error: queued/running -> failed', async () => {
    const queued = await createImportJobRecord(
      'p1',
      'u1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] }
    );
    const failed = await runImportJobPipeline(
      queued,
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      {
        resolveAdapter: () => ({
          mode: 'mock',
          async extractArchitecturalSnapshot() {
            throw new Error('Extractor crash');
          },
        }),
      }
    );
    expect(failed.status).toBe('failed');
    expect(failed.snapshot).toBeNull();
    expect(failed.errorMessage).toContain('Extractor crash');
  });

  it('list сортируется по createdAt (newest first)', async () => {
    const res = await listImportJobs('p1', 'u1');
    expect(res.items[0]?.id).toBe('ij-newer');
    expect(res.items[1]?.id).toBe('ij-older');
  });

  it('mock snapshot создаётся предсказуемо', () => {
    const s = createMockArchitecturalImportSnapshot({ projectName: 'Demo' });
    expect(s.projectMeta.name).toBe('Demo');
    expect(s.outerContour).toBeNull();
    expect(s.walls).toHaveLength(0);
    expect(s.unresolved[0]?.severity).toBe('blocking');
    expect(s.notes[0]).toContain('mock import snapshot generated without AI extractor');
  });

  it('update status работает корректно', async () => {
    const next = await updateImportJobStatus('ij-older', 'running');
    expect(next.status).toBe('running');
    expect(next.snapshot).toBeNull();
  });

  it('completeImportJobWithSnapshot обновляет status/snapshot', async () => {
    await updateImportJobStatus('ij-older', 'running');
    const done = await completeImportJobWithSnapshot(
      'ij-older',
      createMockArchitecturalImportSnapshot()
    );
    expect(done.status).toBe('needs_review');
    expect(done.snapshot?.floors[0]?.id).toBe('floor-1');
    expect(done.errorMessage).toBeNull();
  });

  it('failImportJob обновляет status/errorMessage', async () => {
    const failed = await failImportJob('ij-newer', 'Oops');
    expect(failed.status).toBe('failed');
    expect(failed.errorMessage).toBe('Oops');
    expect(failed.snapshot).toBeNull();
  });

  it('getImportJobById returns existing job', async () => {
    const job = await getImportJobById('ij-newer');
    expect(job.id).toBe('ij-newer');
  });
});
