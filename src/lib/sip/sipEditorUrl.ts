import { getCrmOriginOrWindow, getSipEditorOrigin, type SipClientEnv } from './sipEnv';
type OpenFn = (url?: string | URL, target?: string, features?: string) => Window | null;

const DECOMMISSIONED_EDITOR_HOSTS = new Set(['sip-editor-web-2wix-mvp.netlify.app']);

function buildLegacyLaunchUrl(projectId: string, sipUserId: string, env?: SipClientEnv): string {
  const origin = getCrmOriginOrWindow(env);
  const q = new URLSearchParams({
    projectId: projectId.trim(),
    sipUserId: sipUserId.trim(),
  });
  return origin
    ? `${origin}/integrations/sip-editor?${q.toString()}`
    : `/integrations/sip-editor?${q.toString()}`;
}

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
  try {
    const origin = getSipEditorOrigin(env);
    const parsed = new URL(origin);
    const runtimeOrigin =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

    // Защита от ссылки на удалённый editor-хост и от self-loop на CRM origin.
    if (
      DECOMMISSIONED_EDITOR_HOSTS.has(parsed.hostname) ||
      (runtimeOrigin && parsed.origin === runtimeOrigin)
    ) {
      return buildLegacyLaunchUrl(pid, uid, env);
    }

    const q = new URLSearchParams({ sipUserId: uid });
    return `${origin}/sip-editor/${encodeURIComponent(pid)}?${q.toString()}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes('localhost запрещен')) {
      throw error;
    }

    // Fallback в браузере: не падаем с "production URL не настроен",
    // а открываем рабочую страницу запуска SIP в CRM.
    if (typeof window !== 'undefined') {
      return buildLegacyLaunchUrl(pid, uid, env);
    }

    if (env?.DEV && !env?.PROD) {
      const q = new URLSearchParams({ sipUserId: uid });
      return `http://localhost:5174/sip-editor/${encodeURIComponent(pid)}?${q.toString()}`;
    }

    throw new Error('SIP Editor production URL не настроен: задайте VITE_SIP_EDITOR_ORIGIN');
  }
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
