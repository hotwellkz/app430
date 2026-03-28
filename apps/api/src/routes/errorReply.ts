import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorBody } from '@2wix/shared-types';
import { AppHttpError } from '../errors/httpErrors.js';

/** gRPC / Firestore: 7 = PERMISSION_DENIED (часто IAM на проекте GCP). */
function extractGrpcCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const c = (err as { code?: unknown }).code;
  return typeof c === 'number' ? c : undefined;
}

export function sendRouteError(
  reply: FastifyReply,
  request: FastifyRequest,
  err: unknown
): FastifyReply {
  if (err instanceof AppHttpError) {
    const body: ApiErrorBody = {
      code: err.code,
      message: err.message,
      status: err.statusCode,
      requestId: request.sipRequestId,
    };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    return reply.code(err.statusCode).send(body);
  }

  const grpcCode = extractGrpcCode(err);
  if (grpcCode === 7) {
    request.log.error(err);
    const body: ApiErrorBody = {
      code: 'INTERNAL_ERROR',
      message:
        'Нет доступа к Firestore (IAM). Учётной записи Google нужна роль вроде roles/datastore.user на проекте FIREBASE_PROJECT_ID в GCP, либо укажите GOOGLE_APPLICATION_CREDENTIALS (JSON сервисного аккаунта с доступом к Firestore).',
      status: 503,
      requestId: request.sipRequestId,
      details:
        process.env.NODE_ENV === 'development'
          ? { grpcCode, cause: err instanceof Error ? err.message : String(err) }
          : { grpcCode },
    };
    return reply.code(503).send(body);
  }

  request.log.error(err);
  const devHint =
    process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined;
  const body: ApiErrorBody = {
    code: 'INTERNAL_ERROR',
    message: devHint ? `Внутренняя ошибка: ${devHint}` : 'Внутренняя ошибка',
    status: 500,
    requestId: request.sipRequestId,
    details:
      process.env.NODE_ENV === 'development' && err instanceof Error
        ? { cause: err.message, stack: err.stack }
        : undefined,
  };
  return reply.code(500).send(body);
}
