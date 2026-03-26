import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRequestContext } from '../plugins/requestContext.js';
import { registerProjectRoutes } from './projectsRoutes.js';
import { AppHttpError, NotFoundError, ValidationAppError } from '../errors/httpErrors.js';

vi.mock('../services/importJobService.js', () => ({
  createImportJob: vi.fn(async (projectId: string, body: { sourceImages?: unknown[] }) => {
    if (!Array.isArray(body?.sourceImages) || body.sourceImages.length === 0) {
      throw new ValidationAppError('Невалидное тело запроса');
    }
    return {
      job: {
        id: 'ij-1',
        projectId,
        status:
          process.env.IMPORT_JOB_EXECUTION_MODE === 'async-inline'
            ? 'queued'
            : 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: body.sourceImages,
        snapshot: {
          projectMeta: {},
          floors: [{ id: 'floor-1' }],
          walls: [],
          openings: [],
          stairs: [],
          unresolved: [],
          notes: [],
        },
        errorMessage: null,
      },
    };
  }),
  getImportJob: vi.fn(async (projectId: string, jobId: string) => {
    if (projectId === 'p2') {
      throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
    }
    return {
      job: {
        id: jobId,
        projectId,
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: null,
        errorMessage: null,
      },
    };
  }),
  listImportJobs: vi.fn(async (projectId: string) => ({
    items: [
      {
        id: 'ij-new',
        projectId,
        status: 'needs_review',
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: null,
        errorMessage: null,
      },
      {
        id: 'ij-old',
        projectId,
        status: 'needs_review',
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-2', kind: 'facade', fileName: 'facade.png' }],
        snapshot: null,
        errorMessage: null,
      },
    ],
  })),
  listImportApplyHistory: vi.fn(async (projectId: string) => {
    if (projectId === 'p2') {
      throw new NotFoundError('Проект не найден: p2');
    }
    if (projectId === 'p-empty') {
      return { items: [] };
    }
    return {
      items: [
        {
          versionId: 'v2',
          versionNumber: 2,
          sourceKind: 'ai_import',
          importJobId: 'ij-2',
          mapperVersion: 'import-candidate-v1',
          reviewedSnapshotVersion: 'r2',
          appliedBy: 'u1',
          appliedAt: '2026-03-26T12:00:00.000Z',
          warningsCount: 1,
          traceCount: 10,
          note: null,
        },
      ],
    };
  }),
  saveImportJobReview: vi.fn(async (projectId: string, jobId: string, body: { updatedBy?: string }) => {
    if (projectId === 'p2') {
      throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
    }
    if (!body?.updatedBy) {
      throw new ValidationAppError('Невалидное тело review запроса');
    }
    return {
      job: {
        id: jobId,
        projectId,
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: {
          projectMeta: {},
          floors: [{ id: 'floor-1' }],
          walls: [],
          openings: [],
          stairs: [],
          unresolved: [],
          notes: [],
        },
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: body,
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: false,
        },
        errorMessage: null,
      },
    };
  }),
  applyImportJobReview: vi.fn(async (projectId: string, jobId: string, body: { appliedBy?: string }) => {
    if (projectId === 'p2') {
      throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
    }
    if (!body?.appliedBy) {
      throw new ValidationAppError('Невалидное тело apply-review запроса');
    }
    if (jobId === 'ij-incomplete') {
      throw new AppHttpError(409, 'CONFLICT', 'Review неполный');
    }
    return {
      job: {
        id: jobId,
        projectId,
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: null,
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        errorMessage: null,
      },
      reviewedSnapshot: {
        baseSnapshot: {
          projectMeta: {},
          floors: [{ id: 'floor-1' }],
          walls: [],
          openings: [],
          stairs: [],
          unresolved: [],
          notes: [],
        },
        transformedSnapshot: {
          projectMeta: {},
          floors: [{ id: 'floor-1' }],
          walls: [],
          openings: [],
          stairs: [],
          unresolved: [],
          notes: ['x'],
        },
        appliedDecisions: {},
        resolvedIssueIds: [],
        notes: [],
        generatedAt: new Date().toISOString(),
      },
    };
  }),
  prepareImportJobEditorApply: vi.fn(async (projectId: string, jobId: string, body: { generatedBy?: string }) => {
    if (projectId === 'p2') {
      throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
    }
    if (!body?.generatedBy) {
      throw new ValidationAppError('Невалидное тело prepare-editor-apply запроса');
    }
    if (jobId === 'ij-not-ready') {
      throw new AppHttpError(409, 'CONFLICT', 'Import job не готов к editor-apply stage');
    }
    return {
      job: {
        id: jobId,
        projectId,
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: null,
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        editorApply: {
          status: 'candidate_ready',
          candidate: {
            model: {
              meta: { id: 'm1', name: 'Candidate' },
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
            warnings: [],
            trace: [],
            mapperVersion: 'import-candidate-v1',
            generatedAt: new Date().toISOString(),
            basedOnImportJobId: jobId,
            basedOnReviewedSnapshotVersion: 'x',
          },
          errorMessage: null,
          generatedAt: new Date().toISOString(),
          generatedBy: body.generatedBy,
          mapperVersion: 'import-candidate-v1',
        },
        errorMessage: null,
      },
      candidate: {
        model: {
          meta: { id: 'm1', name: 'Candidate' },
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
        warnings: [],
        trace: [],
        mapperVersion: 'import-candidate-v1',
        generatedAt: new Date().toISOString(),
        basedOnImportJobId: jobId,
        basedOnReviewedSnapshotVersion: 'x',
      },
    };
  }),
  applyImportJobCandidateToProject: vi.fn(async (projectId: string, jobId: string, body: { appliedBy?: string }) => {
    if (projectId === 'p2') {
      throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
    }
    if (!body?.appliedBy) {
      throw new ValidationAppError('Невалидное тело apply-candidate запроса');
    }
    if (jobId === 'ij-apply-conflict') {
      throw new AppHttpError(409, 'IMPORT_APPLY_CONCURRENCY_CONFLICT', 'Concurrency mismatch', {
        currentVersionId: 'v2',
        currentVersionNumber: 2,
        currentSchemaVersion: 2,
      });
    }
    if (jobId === 'ij-no-review') {
      throw new AppHttpError(409, 'IMPORT_REVIEW_NOT_APPLIED', 'Review not applied');
    }
    if (jobId === 'ij-no-candidate') {
      throw new AppHttpError(409, 'IMPORT_CANDIDATE_MISSING', 'Candidate missing');
    }
    if (jobId === 'ij-not-ready-2') {
      throw new AppHttpError(409, 'IMPORT_CANDIDATE_NOT_READY', 'Candidate not ready');
    }
    if (jobId === 'ij-apply-failed') {
      throw new AppHttpError(500, 'IMPORT_APPLY_FAILED', 'Apply failed');
    }
    return {
      job: {
        id: jobId,
        projectId,
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        importSchemaVersion: 1,
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        snapshot: null,
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        editorApply: {
          status: 'candidate_ready',
          errorMessage: null,
        },
        projectApply: {
          status: 'applied',
          appliedAt: new Date().toISOString(),
          appliedBy: body.appliedBy,
          appliedVersionId: 'v-current',
          appliedVersionNumber: 1,
          errorMessage: null,
          summary: {
            createdOrUpdatedVersionId: 'v-current',
            appliedObjectCounts: {
              floors: 1,
              walls: 2,
              openings: 1,
              slabs: 0,
              roofs: 1,
            },
            warningsCount: 0,
            traceCount: 0,
            basedOnImportJobId: jobId,
            basedOnMapperVersion: 'import-candidate-v1',
            basedOnReviewedSnapshotVersion: 'x',
          },
        },
        errorMessage: null,
      },
      appliedVersionMeta: {
        id: 'v-current',
        projectId,
        versionNumber: 1,
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
      },
      applySummary: {
        createdOrUpdatedVersionId: 'v-current',
        appliedObjectCounts: { floors: 1, walls: 2, openings: 1, slabs: 0, roofs: 1 },
        warningsCount: 0,
        traceCount: 0,
        basedOnImportJobId: jobId,
        basedOnMapperVersion: 'import-candidate-v1',
        basedOnReviewedSnapshotVersion: 'x',
      },
    };
  }),
}));

describe('import jobs routes', () => {
  it('create/get/list/review/apply/prepare and validation scenarios', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const headers = { 'x-sip-user-id': 'u1' };
    process.env.IMPORT_JOB_EXECUTION_MODE = 'sync';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs',
      headers,
      payload: {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
        projectName: 'Test',
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect((createRes.json() as { job: { status: string } }).job.status).toBe('needs_review');

    process.env.IMPORT_JOB_EXECUTION_MODE = 'async-inline';
    const createAsyncRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs',
      headers,
      payload: {
        sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
      },
    });
    expect(createAsyncRes.statusCode).toBe(201);
    expect((createAsyncRes.json() as { job: { status: string } }).job.status).toBe('queued');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p1/import-jobs/ij-1',
      headers,
    });
    expect(getRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p1/import-jobs',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { items: Array<{ id: string }> };
    expect(listBody.items[0]?.id).toBe('ij-new');

    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p1/import-apply-history',
      headers,
    });
    expect(historyRes.statusCode).toBe(200);
    expect((historyRes.json() as { items: Array<{ versionId: string }> }).items[0]?.versionId).toBe('v2');

    const emptyHistoryRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p-empty/import-apply-history',
      headers,
    });
    expect(emptyHistoryRes.statusCode).toBe(200);
    expect((emptyHistoryRes.json() as { items: unknown[] }).items).toHaveLength(0);

    const wrongProjectRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p2/import-jobs/ij-1',
      headers,
    });
    expect(wrongProjectRes.statusCode).toBe(404);

    const foreignHistoryRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p2/import-apply-history',
      headers,
    });
    expect(foreignHistoryRes.statusCode).toBe(404);

    const invalidBodyRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs',
      headers,
      payload: { sourceImages: [] },
    });
    expect(invalidBodyRes.statusCode).toBe(400);

    const reviewRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/review',
      headers,
      payload: { updatedBy: 'u1', decisions: { roofTypeConfirmed: 'gabled' } },
    });
    expect(reviewRes.statusCode).toBe(200);

    const applyIncompleteRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-incomplete/apply-review',
      headers,
      payload: { appliedBy: 'u1' },
    });
    expect(applyIncompleteRes.statusCode).toBe(409);

    const applyRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/apply-review',
      headers,
      payload: { appliedBy: 'u1' },
    });
    expect(applyRes.statusCode).toBe(200);

    const prepareNotReadyRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-not-ready/prepare-editor-apply',
      headers,
      payload: { generatedBy: 'u1' },
    });
    expect(prepareNotReadyRes.statusCode).toBe(409);

    const prepareRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/prepare-editor-apply',
      headers,
      payload: { generatedBy: 'u1' },
    });
    expect(prepareRes.statusCode).toBe(200);

    const prepareInvalidRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/prepare-editor-apply',
      headers,
      payload: {},
    });
    expect(prepareInvalidRes.statusCode).toBe(400);

    const prepareForeignRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p2/import-jobs/ij-1/prepare-editor-apply',
      headers,
      payload: { generatedBy: 'u1' },
    });
    expect(prepareForeignRes.statusCode).toBe(404);

    const applyEditorConflictRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-apply-conflict/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyEditorConflictRes.statusCode).toBe(409);
    expect((applyEditorConflictRes.json() as { code: string }).code).toBe(
      'IMPORT_APPLY_CONCURRENCY_CONFLICT'
    );
    expect(
      ((applyEditorConflictRes.json() as { details?: { currentVersionId?: string } }).details
        ?.currentVersionId ?? '')
    ).toBe('v2');

    const applyReviewNotAppliedRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-no-review/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyReviewNotAppliedRes.statusCode).toBe(409);
    expect((applyReviewNotAppliedRes.json() as { code: string }).code).toBe('IMPORT_REVIEW_NOT_APPLIED');

    const applyCandidateMissingRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-no-candidate/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyCandidateMissingRes.statusCode).toBe(409);
    expect((applyCandidateMissingRes.json() as { code: string }).code).toBe('IMPORT_CANDIDATE_MISSING');

    const applyCandidateNotReadyRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-not-ready-2/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyCandidateNotReadyRes.statusCode).toBe(409);
    expect((applyCandidateNotReadyRes.json() as { code: string }).code).toBe('IMPORT_CANDIDATE_NOT_READY');

    const applyCandidateFailedRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-apply-failed/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyCandidateFailedRes.statusCode).toBe(500);
    expect((applyCandidateFailedRes.json() as { code: string }).code).toBe('IMPORT_APPLY_FAILED');

    const applyEditorRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/apply-candidate',
      headers,
      payload: {
        appliedBy: 'u1',
        expectedCurrentVersionId: 'v-current',
        expectedVersionNumber: 1,
        expectedSchemaVersion: 2,
      },
    });
    expect(applyEditorRes.statusCode).toBe(200);

    const applyEditorInvalidRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/import-jobs/ij-1/apply-candidate',
      headers,
      payload: {},
    });
    expect(applyEditorInvalidRes.statusCode).toBe(400);

    await app.close();
    process.env.IMPORT_JOB_EXECUTION_MODE = undefined;
  });
});
