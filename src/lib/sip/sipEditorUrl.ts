import { getCrmOriginOrWindow, getSipEditorOrigin, type SipClientEnv } from './sipEnv';
type OpenFn = (url?: string | URL, target?: string, features?: string) => Window | null;

function shouldLogOpenFlowDiagnostics(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  try {
    return window.localStorage.getItem('sip_debug_open_flow') === '1';
  } catch {
    return false;
  }
}

function logEditorOpen(url: string, projectId: string): void {
  if (!shouldLogOpenFlowDiagnostics()) return;
  let targetOrigin = '';
  try {
    targetOrigin = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined).origin;
  } catch {
    targetOrigin = '';
  }
  console.info('[crm:sip-open-flow]', {
    projectId,
    editorUrl: url,
    targetOrigin,
    crmOrigin: typeof window !== 'undefined' ? window.location.origin : '',
  });
}

/**
 * Полный URL веб-приложения SIP Editor с контекстом пользователя CRM (Firebase UID).
 * Используйте при открытии из CRM; origin задаётся VITE_SIP_EDITOR_ORIGIN.
 */
export function buildSipEditorUrl(
  projectId: string,
  sipUserId: string,
  env?: SipClientEnv
): string {
  const pid = projectId.trim();
  const uid = sipUserId.trim();
  const origin = getSipEditorOrigin(env);
  const runtimeOrigin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  if (runtimeOrigin && origin === runtimeOrigin) {
    throw new Error(
      'VITE_SIP_EDITOR_ORIGIN указывает на текущий CRM origin. Укажите отдельный origin SIP Editor.'
    );
  }
  const q = new URLSearchParams({ sipUserId: uid });
  return `${origin}/sip-editor/${encodeURIComponent(pid)}?${q.toString()}`;
}

export function openSipEditorWindow(
  projectId: string,
  sipUserId: string,
  env?: SipClientEnv,
  openFn?: OpenFn
): string {
  const url = buildSipEditorUrl(projectId, sipUserId, env);
  logEditorOpen(url, projectId.trim());
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
