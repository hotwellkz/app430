import { getCrmOriginOrWindow, getSipEditorOrigin, type SipClientEnv } from './sipEnv';
type OpenFn = (url?: string | URL, target?: string, features?: string) => Window | null;

/**
 * Полный URL веб-приложения SIP Editor с контекстом пользователя CRM (Firebase UID).
 * Используйте при открытии из CRM; origin задаётся VITE_SIP_EDITOR_ORIGIN.
 */
export function buildSipEditorUrl(
  projectId: string,
  sipUserId: string,
  env?: SipClientEnv
): string {
  const origin = getSipEditorOrigin(env);
  const q = new URLSearchParams({ sipUserId: sipUserId.trim() });
  return `${origin}/sip-editor/${encodeURIComponent(projectId.trim())}?${q.toString()}`;
}

export function openSipEditorWindow(
  projectId: string,
  sipUserId: string,
  env?: SipClientEnv,
  openFn?: OpenFn
): string {
  const url = buildSipEditorUrl(projectId, sipUserId, env);
  const opener =
    openFn ??
    (typeof window !== 'undefined' ? window.open.bind(window) : undefined);
  if (!opener) {
    throw new Error('Невозможно открыть окно: browser window недоступен');
  }
  opener(url, '_blank', 'noopener,noreferrer');
  return url;
}

/** Ссылка на список SIP-проектов в CRM (guard-экраны редактора). */
export function buildCrmSipProjectsUrl(): string {
  const origin = getCrmOriginOrWindow();
  return origin ? `${origin}/sip-projects` : '/sip-projects';
}
