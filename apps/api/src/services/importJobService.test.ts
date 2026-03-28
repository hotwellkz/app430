import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Hoisted so vi.mock('./sipProjectService') видит тот же Map, что и тесты. */
const store = vi.hoisted(() => new Map<string, Record<string, any>>());

function assertNoFirestoreUndefined(value: unknown, path = 'root'): void {
  if (value === undefined) {
    throw new Error(`Firestore mock: undefined at ${path}`);
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFirestoreUndefined(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assertNoFirestoreUndefined(v, `${path}.${k}`);
  }
}

function resetStore() {
  store.clear();
  store.set('sipEditor_projectVersions/v-current', {
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
    createdAt: '2026-03-26T10:00:00.000Z',
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  });
  store.set('sipEditor_projectVersions/v-legacy', {
    projectId: 'p1',
    versionNumber: 2,
    schemaVersion: 2,
    buildingModel: {
      meta: { id: 'm2', name: 'Legacy' },
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
    createdAt: '2026-03-25T10:00:00.000Z',
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  });
  store.set('sipEditor_importJobs/ij-older', {
    projectId: 'p1',
    status: 'queued',
    createdBy: 'u1',
    createdAt: '2026-03-25T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    importSchemaVersion: 1,
    sourceImages: [{ id: 'img-old', kind: 'plan', fileName: 'old.png', base64Data: 'WA==' }],
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
    sourceImages: [{ id: 'img-new', kind: 'facade', fileName: 'new.png', base64Data: 'WA==' }],
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
          async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
            const nowIso = new Date('2026-03-26T12:00:00.000Z').toISOString();
            const prev = store.get(key) ?? {};
            if (options?.merge) {
              store.set(key, {
                ...prev,
                ...payload,
                updatedAt: nowIso,
              });
              return;
            }
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
            assertNoFirestoreUndefined(payload);
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
  patchCurrentVersion: vi.fn(async (_projectId: string, body: { buildingModel: unknown }) => {
    const key = 'sipEditor_projectVersions/v-current';
    const prev = store.get(key) ?? {};
    store.set(key, {
      ...prev,
      buildingModel: body.buildingModel,
    });
    return {
      id: 'v-current',
      projectId: 'p1',
      versionNumber: 1,
      schemaVersion: 2,
      buildingModel: body.buildingModel,
      createdAt: new Date('2026-03-26T10:00:00.000Z').toISOString(),
      createdBy: 'u1',
      basedOnVersionId: null,
      isSnapshot: false,
    };
  }),
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
  listImportApplyHistory,
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] }
    );
    const failed = await runImportJobPipeline(
      queued,
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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

  it('runImportJobPipeline передаёт base64Data в extractor (in-memory request)', async () => {
    let capturedBase64: string | undefined;
    const queued = await createImportJobRecord('p1', 'u1', {
      sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
    });
    await runImportJobPipeline(
      queued,
      {
        sourceImages: [
          {
            id: 'img-1',
            kind: 'plan',
            fileName: 'plan.png',
            mimeType: 'image/png',
            base64Data: 'pixel-payload',
          },
        ],
      },
      {
        resolveAdapter: () => ({
          mode: 'mock',
          async extractArchitecturalSnapshot(input) {
            capturedBase64 = input.sourceImages[0]?.base64Data;
            return createMockArchitecturalImportSnapshot({ projectName: 'P' });
          },
        }),
      }
    );
    expect(capturedBase64).toBe('pixel-payload');
  });

  it('runImportJobPipeline может гидратить storage refs (deps.hydrateImportAssets)', async () => {
    const queued = await createImportJobRecord('p1', 'u1', {
      sourceImages: [
        {
          id: 'img-1',
          kind: 'plan',
          fileName: 'a.png',
          storageProvider: 'firebase',
          storagePath: 'sip-import-sources/p1/img-1/a.png',
        },
      ],
    });
    let seen = '';
    await runImportJobPipeline(
      queued,
      {
        sourceImages: [
          {
            id: 'img-1',
            kind: 'plan',
            fileName: 'a.png',
            storageProvider: 'firebase',
            storagePath: 'sip-import-sources/p1/img-1/a.png',
          },
        ],
      },
      {
        hydrateImportAssets: async () => [
          {
            id: 'img-1',
            kind: 'plan',
            fileName: 'a.png',
            base64Data: 'hydrated-b64',
          },
        ],
        resolveAdapter: () => ({
          mode: 'mock',
          async extractArchitecturalSnapshot(input) {
            seen = input.sourceImages[0]?.base64Data ?? '';
            return createMockArchitecturalImportSnapshot();
          },
        }),
      }
    );
    expect(seen).toBe('hydrated-b64');
  });

  it('list сортируется по createdAt (newest first)', async () => {
    const res = await listImportJobs('p1', 'u1');
    expect(res.items[0]?.id).toBe('ij-newer');
    expect(res.items[1]?.id).toBe('ij-older');
  });

  it('mock snapshot создаётся предсказуемо', () => {
    const s = createMockArchitecturalImportSnapshot({ projectName: 'Demo' });
    expect(s.projectMeta.name).toBe('Demo');
    expect(s.outerContour?.points?.length).toBeGreaterThanOrEqual(3);
    expect(s.walls).toHaveLength(0);
    expect(s.floors[0]?.label).toBe('Floor 1');
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

  it('draft editorApply без candidate: запись в Firestore без undefined (MVP pipeline)', async () => {
    await updateImportJobStatus('ij-older', 'running');
    await completeImportJobWithSnapshot('ij-older', createMockArchitecturalImportSnapshot());
    const raw = store.get('sipEditor_importJobs/ij-older');
    expect(raw?.editorApply?.status).toBe('draft');
    expect('candidate' in (raw?.editorApply ?? {})).toBe(false);
    expect(raw?.editorApply?.candidate).toBeUndefined();
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }],
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
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
    const versionDoc = store.get('sipEditor_projectVersions/v-current');
    expect(versionDoc?.importProvenance?.importJobId).toBe(created.job.id);
    expect(versionDoc?.importProvenance?.mapperVersion).toBe('import-candidate-v2');
    const jobAfterPrepare = store.get(`sipEditor_importJobs/${created.job.id}`);
    const expectedModel = jobAfterPrepare?.editorApply?.candidate?.model;
    expect(expectedModel).toBeTruthy();
    expect(versionDoc?.buildingModel).toEqual(expectedModel);
    expect(infoSpy).toHaveBeenCalled();
    expect(infoSpy.mock.calls.some((call) => String(call[0]).includes('import_apply_candidate_success'))).toBe(
      true
    );
    infoSpy.mockRestore();
  });

  it('cannot apply candidate before review is applied', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes('import_apply_candidate_conflict'))).toBe(
      true
    );
    warnSpy.mockRestore();
  });

  it('repeated apply returns previously applied summary', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
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

  it('history lists ai-import applies newest first and skips versions without provenance', async () => {
    store.set('sipEditor_projectVersions/v-old-ai', {
      projectId: 'p1',
      versionNumber: 3,
      schemaVersion: 2,
      buildingModel: store.get('sipEditor_projectVersions/v-current')?.buildingModel,
      createdAt: '2026-03-24T10:00:00.000Z',
      createdBy: 'u1',
      importProvenance: {
        sourceKind: 'ai_import',
        importJobId: 'ij-old',
        mapperVersion: 'import-candidate-v2',
        reviewedSnapshotVersion: 'rev-old',
        appliedBy: 'u1',
        appliedAt: '2026-03-24T11:00:00.000Z',
        warningsCount: 1,
        traceCount: 2,
      },
    });
    store.set('sipEditor_projectVersions/v-new-ai', {
      projectId: 'p1',
      versionNumber: 4,
      schemaVersion: 2,
      buildingModel: store.get('sipEditor_projectVersions/v-current')?.buildingModel,
      createdAt: '2026-03-26T10:00:00.000Z',
      createdBy: 'u1',
      importProvenance: {
        sourceKind: 'ai_import',
        importJobId: 'ij-new',
        mapperVersion: 'import-candidate-v2',
        reviewedSnapshotVersion: 'rev-new',
        appliedBy: 'u1',
        appliedAt: '2026-03-26T11:00:00.000Z',
        warningsCount: 0,
        traceCount: 3,
      },
    });
    const result = await listImportApplyHistory('p1', 'u1');
    expect(result.items[0]?.versionId).toBe('v-new-ai');
    expect(result.items[1]?.versionId).toBe('v-old-ai');
    expect(result.items.some((x) => x.versionId === 'v-legacy')).toBe(false);
  });

  it('marks incomplete legacy provenance safely with missingFields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.set('sipEditor_projectVersions/v-legacy-ai', {
      projectId: 'p1',
      versionNumber: 5,
      schemaVersion: 2,
      buildingModel: store.get('sipEditor_projectVersions/v-current')?.buildingModel,
      createdAt: '2026-03-26T09:00:00.000Z',
      createdBy: 'u1',
      importProvenance: {
        sourceKind: 'ai_import',
        importJobId: 'ij-legacy',
        mapperVersion: 'import-candidate-v2',
      },
    });
    const result = await listImportApplyHistory('p1', 'u1');
    const legacyItem = result.items.find((x) => x.versionId === 'v-legacy-ai');
    expect(legacyItem?.isLegacy).toBe(true);
    expect(legacyItem?.isIncomplete).toBe(true);
    expect(legacyItem?.missingFields?.includes('reviewedSnapshotVersion')).toBe(true);
    expect(legacyItem?.missingFields?.includes('appliedAt')).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes('import_history_legacy_item_detected'))
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('integration happy-path: create -> review -> apply-review -> prepare -> apply-candidate -> history', async () => {
    const created = await createImportJob(
      'p1',
      { sourceImages: [{ id: 'img-100', kind: 'plan', fileName: 'plan.png', base64Data: 'WA==' }] },
      'u1'
    );
    const jobId = created.job.id;
    expect(created.job.status).toBe('needs_review');
    expect(created.job.snapshot).toBeTruthy();
    assertNoFirestoreUndefined(store.get(`sipEditor_importJobs/${jobId}`));

    await saveImportJobReview(
      'p1',
      jobId,
      {
        updatedBy: 'u1',
        decisions: {
          floorHeightsMmByFloorId: { 'floor-1': 2800 },
        },
      },
      'u1'
    );
    await saveImportJobReview(
      'p1',
      jobId,
      {
        updatedBy: 'u1',
        decisions: {
          roofTypeConfirmed: 'gabled',
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' },
          issueResolutions: [{ issueId: 'mock-extractor-not-connected', action: 'confirm' }],
        },
      },
      'u1'
    );
    await applyImportJobReview('p1', jobId, { appliedBy: 'u1' }, 'u1');
    assertNoFirestoreUndefined(store.get(`sipEditor_importJobs/${jobId}`));
    await prepareImportJobEditorApply('p1', jobId, { generatedBy: 'u1' }, 'u1');
    assertNoFirestoreUndefined(store.get(`sipEditor_importJobs/${jobId}`));
    expect(store.get(`sipEditor_importJobs/${jobId}`)?.editorApply?.status).toBe('candidate_ready');
    expect(store.get(`sipEditor_importJobs/${jobId}`)?.editorApply?.candidate).toBeTruthy();
    await applyImportJobCandidateToProject(
      'p1',
      jobId,
      {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
        note: 'integration-e2e',
      },
      'u1'
    );
    assertNoFirestoreUndefined(store.get(`sipEditor_importJobs/${jobId}`));

    const versionDoc = store.get('sipEditor_projectVersions/v-current');
    expect(versionDoc?.importProvenance?.importJobId).toBe(jobId);
    expect(versionDoc?.importProvenance?.mapperVersion).toBe('import-candidate-v2');
    expect(versionDoc?.importProvenance?.reviewedSnapshotVersion).toBeTruthy();
    expect(versionDoc?.importProvenance?.appliedBy).toBe('u1');
    expect(versionDoc?.importProvenance?.appliedAt).toBeTruthy();

    const history = await listImportApplyHistory('p1', 'u1');
    const applied = history.items.find((x) => x.importJobId === jobId);
    expect(applied?.mapperVersion).toBe('import-candidate-v2');
    expect(applied?.reviewedSnapshotVersion).toBeTruthy();
    expect(applied?.appliedBy).toBe('u1');
    expect(applied?.appliedAt).toBeTruthy();
  });
});
