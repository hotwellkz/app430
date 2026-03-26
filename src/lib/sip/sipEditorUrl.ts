import { getCrmOriginOrWindow, getSipEditorOrigin } from './sipEnv';

/**
 * Полный URL веб-приложения SIP Editor с контекстом пользователя CRM (Firebase UID).
 * Используйте при открытии из CRM; origin задаётся VITE_SIP_EDITOR_ORIGIN.
 */
export function buildSipEditorUrl(projectId: string, sipUserId: string): string {
  const origin = getSipEditorOrigin();
  const q = new URLSearchParams({ sipUserId: sipUserId.trim() });
  return `${origin}/sip-editor/${encodeURIComponent(projectId.trim())}?${q.toString()}`;
}

/** Ссылка на список SIP-проектов в CRM (guard-экраны редактора). */
export function buildCrmSipProjectsUrl(): string {
  const origin = getCrmOriginOrWindow();
  return origin ? `${origin}/sip-projects` : '/sip-projects';
}
