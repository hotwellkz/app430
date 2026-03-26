import type { FastifyInstance } from 'fastify';
import { requireSipUserId } from '../plugins/requestContext.js';
import { sendRouteError } from './errorReply.js';
import {
  createProject,
  createVersion,
  getCurrentVersion,
  getProject,
  listProjectsForUser,
  listVersions,
  patchCurrentVersion,
} from '../services/sipProjectService.js';

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/projects', async (request, reply) => {
    try {
      const actorId = requireSipUserId(request);
      const q = request.query as { limit?: string };
      const raw = parseInt(String(q?.limit ?? '50'), 10);
      const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 50;
      const projects = await listProjectsForUser(actorId, limit);
      return reply.send({ projects });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post('/api/projects', async (request, reply) => {
    try {
      const actorId = requireSipUserId(request);
      const result = await createProject(request.body, actorId);
      return reply.code(201).send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (request, reply) => {
      try {
        const actorId = requireSipUserId(request);
        const project = await getProject(request.params.projectId, actorId);
        return reply.send({ project });
      } catch (e) {
        return sendRouteError(reply, request, e);
      }
    }
  );

  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/versions',
    async (request, reply) => {
      try {
        const actorId = requireSipUserId(request);
        const versions = await listVersions(request.params.projectId, actorId);
        return reply.send({ versions });
      } catch (e) {
        return sendRouteError(reply, request, e);
      }
    }
  );

  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/current-version',
    async (request, reply) => {
      try {
        const actorId = requireSipUserId(request);
        const version = await getCurrentVersion(request.params.projectId, actorId);
        if (!version) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Текущая версия не назначена',
            status: 404,
            requestId: request.sipRequestId,
          });
        }
        return reply.send({ version });
      } catch (e) {
        return sendRouteError(reply, request, e);
      }
    }
  );

  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/versions',
    async (request, reply) => {
      try {
        const actorId = requireSipUserId(request);
        const version = await createVersion(
          request.params.projectId,
          request.body,
          actorId
        );
        return reply.code(201).send({ version });
      } catch (e) {
        return sendRouteError(reply, request, e);
      }
    }
  );

  app.patch<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/current-version',
    async (request, reply) => {
      try {
        const actorId = requireSipUserId(request);
        const version = await patchCurrentVersion(
          request.params.projectId,
          request.body,
          actorId
        );
        return reply.send({ version });
      } catch (e) {
        return sendRouteError(reply, request, e);
      }
    }
  );
}
