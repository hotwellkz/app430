import type { Project } from '@2wix/shared-types';
import { ForbiddenError } from '../errors/httpErrors.js';

/** Чтение/запись SIP-проекта для пользователя CRM (Firebase UID). */
export function canAccessProject(project: Project, userId: string): boolean {
  if (!userId) return false;
  const list = project.allowedEditorIds;
  if (list && list.length > 0) {
    return list.includes(userId);
  }
  if (project.createdBy) {
    return project.createdBy === userId;
  }
  /** Legacy / без владельца: допускаем любого с заголовком (dev bridge). */
  return true;
}

export function assertCanAccessProject(project: Project, userId: string): void {
  if (!canAccessProject(project, userId)) {
    throw new ForbiddenError();
  }
}

export function assertActorMatchesHeader(
  bodyField: string,
  headerUserId: string
): void {
  if (bodyField !== headerUserId) {
    throw new ForbiddenError(
      'Поле createdBy/updatedBy должно совпадать с x-sip-user-id'
    );
  }
}
