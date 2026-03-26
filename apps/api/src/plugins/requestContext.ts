import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../errors/httpErrors.js';

const HDR_USER = 'x-sip-user-id';
const HDR_REQUEST = 'x-request-id';

declare module 'fastify' {
  interface FastifyRequest {
    sipRequestId: string;
    /** Firebase UID / CRM user id из bridge-заголовка */
    sipUserId: string | null;
  }
}

export function registerRequestContext(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    const incoming = request.headers[HDR_REQUEST];
    request.sipRequestId =
      typeof incoming === 'string' && incoming.trim()
        ? incoming.trim()
        : randomUUID();

    const uid = request.headers[HDR_USER];
    request.sipUserId =
      typeof uid === 'string' && uid.trim() ? uid.trim() : null;
  });
}

export function requireSipUserId(request: FastifyRequest): string {
  if (!request.sipUserId) {
    throw new UnauthorizedError();
  }
  return request.sipUserId;
}
