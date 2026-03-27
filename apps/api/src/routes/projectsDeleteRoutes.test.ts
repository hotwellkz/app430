import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRequestContext } from '../plugins/requestContext.js';
import { registerProjectRoutes } from './projectsRoutes.js';
import { NotFoundError } from '../errors/httpErrors.js';

vi.mock('../services/sipProjectService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sipProjectService.js')>();
  return {
    ...actual,
    deleteProject: vi.fn(async (projectId: string) => {
      if (projectId === 'missing' || projectId.trim() === 'missing') {
        throw new NotFoundError('Проект не найден');
      }
      return { deleted: true as const, projectId: projectId.trim() };
    }),
  };
});

describe('DELETE /api/projects/:projectId', () => {
  it('возвращает 200 и { deleted: true }', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/projects/p1',
      headers: { 'x-sip-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { deleted?: boolean; projectId?: string };
    expect(body.deleted).toBe(true);
    expect(body.projectId).toBe('p1');
    await app.close();
  });

  it('404 если deleteProject бросает NotFound', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/projects/missing',
      headers: { 'x-sip-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('401 без x-sip-user-id', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/projects/p1',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
