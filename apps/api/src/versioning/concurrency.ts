import type { VersionConflictDetails } from '@2wix/shared-types';

/**
 * Проверка optimistic concurrency для PATCH current-version.
 * Возвращает детали конфликта или null, если ожидания совпали с сервером.
 */
export function evaluateVersionConcurrency(args: {
  expectedCurrentVersionId: string;
  expectedVersionNumber: number;
  expectedSchemaVersion: number;
  serverCurrentVersionId: string | null;
  serverVersionNumber: number | null;
  serverSchemaVersion: number;
  serverUpdatedAtIso: string;
}): VersionConflictDetails | null {
  const {
    expectedCurrentVersionId,
    expectedVersionNumber,
    expectedSchemaVersion,
    serverCurrentVersionId,
    serverVersionNumber,
    serverSchemaVersion,
    serverUpdatedAtIso,
  } = args;

  if (
    !serverCurrentVersionId ||
    serverVersionNumber === null ||
    expectedCurrentVersionId !== serverCurrentVersionId ||
    expectedVersionNumber !== serverVersionNumber ||
    expectedSchemaVersion !== serverSchemaVersion
  ) {
    return {
      currentVersionId: serverCurrentVersionId ?? '',
      currentVersionNumber: serverVersionNumber ?? 0,
      serverUpdatedAt: serverUpdatedAtIso,
    };
  }
  return null;
}
