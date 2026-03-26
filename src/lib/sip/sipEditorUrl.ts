/**
 * Полный URL веб-приложения SIP Editor с контекстом пользователя CRM (Firebase UID).
 * Используйте при открытии из CRM; origin задаётся VITE_SIP_EDITOR_ORIGIN.
 */
export function buildSipEditorUrl(projectId: string, sipUserId: string): string {
  const raw = import.meta.env.VITE_SIP_EDITOR_ORIGIN as string | undefined;
  const origin = (typeof raw === 'string' && raw.trim() ? raw : 'http://localhost:5174').replace(/\/$/, '');
  const q = new URLSearchParams({ sipUserId: sipUserId.trim() });
  return `${origin}/sip-editor/${encodeURIComponent(projectId.trim())}?${q.toString()}`;
}

/** Ссылка на список SIP-проектов в CRM (guard-экраны редактора). */
export function buildCrmSipProjectsUrl(): string {
  const raw = import.meta.env.VITE_CRM_ORIGIN as string | undefined;
  if (typeof raw === 'string' && raw.trim()) {
    return `${raw.replace(/\/$/, '')}/sip-projects`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/sip-projects`;
  }
  return '/sip-projects';
}
