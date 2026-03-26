export interface SipClientEnv {
  VITE_SIP_API_BASE_URL?: string;
  VITE_SIP_EDITOR_ORIGIN?: string;
  VITE_CRM_ORIGIN?: string;
  DEV?: boolean;
  PROD?: boolean;
}

function runtimeEnv(): SipClientEnv {
  return import.meta.env as unknown as SipClientEnv;
}

function requireValidBase(value: string, key: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${key} задан, но пустой`);
  }
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/$/, '');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${key} должен быть абсолютным URL или относительным префиксом "/..."`);
  }
}

function isLocalhostUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getSipApiBase(env: SipClientEnv = runtimeEnv()): string {
  const raw = env.VITE_SIP_API_BASE_URL;
  if (!raw || !raw.trim()) return '/sip-editor-api';
  return requireValidBase(raw, 'VITE_SIP_API_BASE_URL');
}

export function getSipEditorOrigin(env: SipClientEnv = runtimeEnv()): string {
  const raw = env.VITE_SIP_EDITOR_ORIGIN;
  if (!raw || !raw.trim()) {
    if (env.DEV) return 'http://localhost:5174';
    throw new Error('SIP Editor production URL не настроен: задайте VITE_SIP_EDITOR_ORIGIN');
  }
  const trimmed = raw.trim();
  try {
    const normalized = new URL(trimmed).toString().replace(/\/$/, '');
    if (env.PROD && isLocalhostUrl(normalized)) {
      throw new Error(
        'SIP Editor production URL не настроен: localhost запрещен для VITE_SIP_EDITOR_ORIGIN'
      );
    }
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message.includes('localhost запрещен')) {
      throw error;
    }
    throw new Error('VITE_SIP_EDITOR_ORIGIN должен быть валидным абсолютным URL');
  }
}

export function getCrmOriginOrWindow(
  env: SipClientEnv = runtimeEnv(),
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined
): string {
  const raw = env.VITE_CRM_ORIGIN;
  if (raw && raw.trim()) {
    try {
      return new URL(raw.trim()).toString().replace(/\/$/, '');
    } catch {
      throw new Error('VITE_CRM_ORIGIN должен быть валидным абсолютным URL');
    }
  }
  if (win?.location?.origin) {
    return win.location.origin;
  }
  return '';
}

export function validateSipEnv(): void {
  const env = runtimeEnv();
  void getSipApiBase(env);
  if (env.VITE_SIP_EDITOR_ORIGIN?.trim()) {
    void getSipEditorOrigin(env);
  }
  void getCrmOriginOrWindow(env);
}

