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
}));

describe('import jobs routes', () => {
  it('create/get/list/review/apply and validation scenarios', async () => {
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

    const wrongProjectRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p2/import-jobs/ij-1',
      headers,
    });
    expect(wrongProjectRes.statusCode).toBe(404);

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

    await app.close();
    process.env.IMPORT_JOB_EXECUTION_MODE = undefined;
  });
});
