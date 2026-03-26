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
  patchCurrentVersion: vi.fn(async (_projectId: string, body: { buildingModel: unknown }) => ({
    id: 'v-current',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: body.buildingModel,
    createdAt: new Date('2026-03-26T10:00:00.000Z').toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  })),
  getCurrentVersion: vi.fn(async () => ({
    id: 'v-current',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: {
      meta: { id: 'm1', name: 'Current' },
      settings: { units: 'mm', defaultWallThicknessMm: 163, gridStepMm: 100 },
      floors: [],
      walls: [],
      openings: [],
      slabs: [],
      roofs: [],
      panelLibrary: [],
      panelSettings: {
        defaultPanelTypeId: null,
        allowTrimmedPanels: true,
        minTrimWidthMm: 250,
        preferFullPanels: true,
        labelPrefixWall: 'W',
        labelPrefixRoof: 'R',
        labelPrefixSlab: 'S',
      },
    },
    createdAt: new Date('2026-03-26T10:00:00.000Z').toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  })),
}));

import {
  applyImportJobCandidateToProject,
  applyImportJobReview,
  completeImportJobWithSnapshot,
  createImportJob,
  createImportJobRecord,
  failImportJob,
  getImportJobById,
  listImportJobs,
  runImportJobPipeline,
  prepareImportJobEditorApply,
  saveImportJobReview,
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

  it('partial review save updates decisions and recalculates remaining blocking', async () => {
    const created = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        projectName: 'Review Test',
      },
      'u1'
    );
    const review1 = await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
        },
      },
      'u1'
    );
    expect(review1.job.review?.isReadyToApply).toBe(false);
    expect((review1.job.review?.missingRequiredDecisions.length ?? 0) > 0).toBe(true);

    const review2 = await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    expect(review2.job.review?.isReadyToApply).toBe(true);
    expect(review2.job.review?.remainingBlockingIssueIds).toHaveLength(0);
  });

  it('apply-review builds reviewed snapshot and keeps original snapshot', async () => {
    const created = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
      },
      'u1'
    );
    const originalSnapshot = structuredClone(created.job.snapshot);
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 3000 },
          roofTypeConfirmed: 'single-slope',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'override', mmPerPixel: 2.5 },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'override' }],
        },
      },
      'u1'
    );
    const applied = await applyImportJobReview(
      'p1',
      created.job.id,
      { appliedBy: 'u1' },
      'u1'
    );
    expect(applied.job.review?.status).toBe('applied');
    expect(applied.reviewedSnapshot.transformedSnapshot.floors[0]?.elevationHintMm).toBe(3000);
    expect(created.job.snapshot).toEqual(originalSnapshot);
  });

  it('apply-review blocked when required decisions missing', async () => {
    const created = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
      },
      'u1'
    );
    await expect(
      applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1')
    ).rejects.toThrow(/Review неполный/);
  });

  it('repeated apply-review returns existing reviewed snapshot', async () => {
    const created = await createImportJob(
      'p1',
      {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
      },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    const first = await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    const second = await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    expect(second.reviewedSnapshot.generatedAt).toBe(first.reviewedSnapshot.generatedAt);
  });

  it('cannot prepare candidate before review.apply', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await expect(
      prepareImportJobEditorApply(
        'p1',
        created.job.id,
        { generatedBy: 'u1' },
        'u1'
      )
    ).rejects.toThrow(/Review должен быть applied/);
  });

  it('builds and stores candidate from reviewed snapshot', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    const prepared = await prepareImportJobEditorApply(
      'p1',
      created.job.id,
      { generatedBy: 'u1' },
      'u1'
    );
    expect(prepared.candidate.model.meta.name.length).toBeGreaterThan(0);
    expect(prepared.job.editorApply?.status).toBe('candidate_ready');
  });

  it('repeat prepare recalculates candidate predictably', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    const one = await prepareImportJobEditorApply(
      'p1',
      created.job.id,
      { generatedBy: 'u1' },
      'u1'
    );
    const two = await prepareImportJobEditorApply(
      'p1',
      created.job.id,
      { generatedBy: 'u1' },
      'u1'
    );
    expect(two.candidate.mapperVersion).toBe(one.candidate.mapperVersion);
    expect(two.candidate.basedOnImportJobId).toBe(one.candidate.basedOnImportJobId);
  });

  it('applies candidate into current version with optimistic concurrency payload', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    await prepareImportJobEditorApply('p1', created.job.id, { generatedBy: 'u1' }, 'u1');
    const result = await applyImportJobCandidateToProject(
      'p1',
      created.job.id,
      {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
      'u1'
    );
    expect(result.appliedVersionMeta.id).toBe('v-current');
    expect(result.job.projectApply?.status).toBe('applied');
    expect(result.job.projectApply?.appliedBy).toBe('u1');
    expect(result.applySummary.warningsCount).toBeGreaterThanOrEqual(0);
  });

  it('cannot apply candidate before review is applied', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await expect(
      applyImportJobCandidateToProject(
        'p1',
        created.job.id,
        {
          appliedBy: 'u1',
          expectedCurrentVersionId: 'v-current',
          expectedVersionNumber: 1,
          expectedSchemaVersion: 2,
        },
        'u1'
      )
    ).rejects.toThrow(/Review должен быть applied/);
  });

  it('cannot apply candidate before candidate_ready', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    await expect(
      applyImportJobCandidateToProject(
        'p1',
        created.job.id,
        {
          appliedBy: 'u1',
          expectedCurrentVersionId: 'v-current',
          expectedVersionNumber: 1,
          expectedSchemaVersion: 2,
        },
        'u1'
      )
    ).rejects.toThrow(/candidate еще не подготовлен/);
  });

  it('blocks apply on concurrency mismatch', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    await prepareImportJobEditorApply('p1', created.job.id, { generatedBy: 'u1' }, 'u1');
    await expect(
      applyImportJobCandidateToProject(
        'p1',
        created.job.id,
        {
          appliedBy: 'u1',
          expectedCurrentVersionId: 'v-other',
          expectedVersionNumber: 999,
          expectedSchemaVersion: 2,
        },
        'u1'
      )
    ).rejects.toThrow(/версия проекта изменилась/);
  });

  it('repeated apply returns previously applied summary', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }] },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      created.job.id,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', created.job.id, { appliedBy: 'u1' }, 'u1');
    await prepareImportJobEditorApply('p1', created.job.id, { generatedBy: 'u1' }, 'u1');
    const first = await applyImportJobCandidateToProject(
      'p1',
      created.job.id,
      {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
      'u1'
    );
    const second = await applyImportJobCandidateToProject(
      'p1',
      created.job.id,
      {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
      'u1'
    );
    expect(second.applySummary.createdOrUpdatedVersionId).toBe(first.applySummary.createdOrUpdatedVersionId);
  });
});
