import type { ApiErrorCode, VersionConflictDetails } from '@2wix/shared-types';

export class AppHttpError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppHttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationAppError extends AppHttpError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationAppError';
  }
}

export class UnauthorizedError extends AppHttpError {
  constructor(message = 'Требуется идентификатор пользователя') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppHttpError {
  constructor(message = 'Нет доступа к проекту') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppHttpError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class VersionConflictError extends AppHttpError {
  readonly conflict: VersionConflictDetails;

  constructor(conflict: VersionConflictDetails) {
    super(
      409,
      'CONFLICT',
      'Данные на сервере изменились. Обновите версию и повторите сохранение.',
      conflict
    );
    this.name = 'VersionConflictError';
    this.conflict = conflict;
  }
}

export class InternalError extends AppHttpError {
  constructor(message = 'Внутренняя ошибка') {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'InternalError';
  }
}
