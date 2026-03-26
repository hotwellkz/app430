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

export function getSipApiBase(): string {
  const raw = import.meta.env.VITE_SIP_API_BASE_URL as string | undefined;
  if (!raw || !raw.trim()) return '/sip-editor-api';
  return requireValidBase(raw, 'VITE_SIP_API_BASE_URL');
}

export function getSipEditorOrigin(): string {
  const raw = import.meta.env.VITE_SIP_EDITOR_ORIGIN as string | undefined;
  if (!raw || !raw.trim()) return 'http://localhost:5174';
  const trimmed = raw.trim();
  try {
    return new URL(trimmed).toString().replace(/\/$/, '');
  } catch {
    throw new Error('VITE_SIP_EDITOR_ORIGIN должен быть валидным абсолютным URL');
  }
}

export function getCrmOriginOrWindow(): string {
  const raw = import.meta.env.VITE_CRM_ORIGIN as string | undefined;
  if (raw && raw.trim()) {
    try {
      return new URL(raw.trim()).toString().replace(/\/$/, '');
    } catch {
      throw new Error('VITE_CRM_ORIGIN должен быть валидным абсолютным URL');
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function validateSipEnv(): void {
  void getSipApiBase();
  void getSipEditorOrigin();
  void getCrmOriginOrWindow();
}

