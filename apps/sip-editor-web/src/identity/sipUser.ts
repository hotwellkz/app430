const STORAGE_KEY = 'sip_editor_user_id';

/** Вызывать при старте приложения: ?sipUserId= из CRM deep link. */
export function bootstrapSipUserFromUrl(): void {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  const uid = q.get('sipUserId');
  if (uid && uid.trim()) {
    sessionStorage.setItem(STORAGE_KEY, uid.trim());
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
  if (t) sessionStorage.setItem(STORAGE_KEY, t);
}

export function sipUserHeaders(): Record<string, string> {
  const id = getSipUserId();
  if (!id) return {};
  return { 'x-sip-user-id': id };
}
