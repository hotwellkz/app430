import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRequestContext } from '../plugins/requestContext.js';
import { registerProjectRoutes } from './projectsRoutes.js';
import { NotFoundError, ValidationAppError } from '../errors/httpErrors.js';

vi.mock('../services/importJobService.js', () => ({
  createImportJob: vi.fn(async (projectId: string, body: { sourceImages?: unknown[] }) => {
    if (!Array.isArray(body?.sourceImages) || body.sourceImages.length === 0) {
      throw new ValidationAppError('Невалидное тело запроса');
    }
    return {
      job: {
        id: 'ij-1',
        projectId,
        status: 'needs_review',
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
}));

describe('import jobs routes', () => {
  it('create/get/list and validation scenarios', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const headers = { 'x-sip-user-id': 'u1' };
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

    await app.close();
  });
});
