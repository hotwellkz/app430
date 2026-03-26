import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorBody } from '@2wix/shared-types';
import { AppHttpError } from '../errors/httpErrors.js';

export function sendRouteError(
  reply: FastifyReply,
  request: FastifyRequest,
  err: unknown
): FastifyReply {
  if (err instanceof AppHttpError) {
    const body: ApiErrorBody = {
      code: err.code,
      message: err.message,
      requestId: request.sipRequestId,
    };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    return reply.code(err.statusCode).send(body);
  }
  request.log.error(err);
  const body: ApiErrorBody = {
    code: 'INTERNAL_ERROR',
    message: 'Внутренняя ошибка',
    requestId: request.sipRequestId,
  };
  return reply.code(500).send(body);
}
