const STORAGE_KEY = 'sip_editor_user_id';
const FALLBACK_KEY = 'sip_editor_user_id_fallback';

export interface SipUserContext {
  sipUserId: string | null;
  source: 'query' | 'session' | 'localStorage' | 'none';
}

/** Вызывать при старте приложения: ?sipUserId= из CRM deep link. */
export function bootstrapSipUserFromUrl(): void {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  const uid = q.get('sipUserId');
  if (uid && uid.trim()) {
    rememberSipUserId(uid.trim());
    return;
  }
  const fromLocal = localStorage.getItem(FALLBACK_KEY);
  if (fromLocal && fromLocal.trim() && !sessionStorage.getItem(STORAGE_KEY)) {
    sessionStorage.setItem(STORAGE_KEY, fromLocal.trim());
  }
}

export function getSipUserId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Сохранить UID для запросов к SIP API (dev-launch и т.п.). */
export function rememberSipUserId(uid: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const t = uid.trim();
  if (t) {
    sessionStorage.setItem(STORAGE_KEY, t);
    localStorage.setItem(FALLBACK_KEY, t);
  }
}

export function sipUserHeaders(): Record<string, string> {
  const id = getSipUserId();
  if (!id) return {};
  return { 'x-sip-user-id': id };
}

export function resolveSipUserContext(): SipUserContext {
  if (typeof window === 'undefined') {
    return { sipUserId: null, source: 'none' };
  }
  const q = new URLSearchParams(window.location.search).get('sipUserId')?.trim();
  if (q) return { sipUserId: q, source: 'query' };
  const ss = sessionStorage.getItem(STORAGE_KEY)?.trim();
  if (ss) return { sipUserId: ss, source: 'session' };
  const ls = localStorage.getItem(FALLBACK_KEY)?.trim();
  if (ls) return { sipUserId: ls, source: 'localStorage' };
  return { sipUserId: null, source: 'none' };
}
