function isValidBase(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateEditorEnv(): void {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const crmOrigin = import.meta.env.VITE_CRM_ORIGIN as string | undefined;
  if (apiBase && apiBase.trim() && !isValidBase(apiBase.trim())) {
    throw new Error('VITE_API_BASE_URL должен быть абсолютным URL или относительным "/..."');
  }
  if (crmOrigin && crmOrigin.trim()) {
    try {
      new URL(crmOrigin.trim());
    } catch {
      throw new Error('VITE_CRM_ORIGIN должен быть абсолютным URL');
    }
  }
}

