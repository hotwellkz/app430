import type { ApiErrorBody } from '@2wix/shared-types';
import { sipUserHeaders } from '@/identity/sipUser';

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function parsePositiveMsEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** JSON к SIP API (импорт, тяжёлые списки, cold start) — 15 с часто мало локально. */
const API_TIMEOUT_MS = parsePositiveMsEnv(import.meta.env.VITE_SIP_API_TIMEOUT_MS, 120_000);
/** Multipart upload (import sources) — дольше обычного JSON; при медленном канале задайте VITE_SIP_API_UPLOAD_TIMEOUT_MS. */
const UPLOAD_TIMEOUT_MS = parsePositiveMsEnv(import.meta.env.VITE_SIP_API_UPLOAD_TIMEOUT_MS, 600_000);

const MSG_TIMEOUT =
  'SIP API не ответил вовремя (timeout). Запустите backend (pnpm dev:api → :3001), проверьте Vite proxy и при необходимости увеличьте VITE_SIP_API_TIMEOUT_MS в .env.';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function fallbackApiUrl(path: string): string | null {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!p.startsWith('/api/')) return null;
  if (!base || base.startsWith('/')) return null;
  return `/sip-editor-api${p}`;
}

export class SipApiError extends Error {
  readonly status: number;
  readonly apiBody: ApiErrorBody;

  constructor(status: number, apiBody: ApiErrorBody) {
    super(apiBody.message);
    this.name = 'SipApiError';
    this.status = status;
    this.apiBody = apiBody;
  }

  get code(): string {
    return this.apiBody.code;
  }

  get conflictDetails(): unknown {
    return this.apiBody.details;
  }
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const sip = sipUserHeaders();
  const headers = {
    'Content-Type': 'application/json',
    ...sip,
    ...(init?.headers ?? {}),
  };
  async function doFetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  let r: Response;
  try {
    r = await doFetch(apiUrl(path));
  } catch (error) {
    const fallback = fallbackApiUrl(path);
    if (fallback) {
      try {
        r = await doFetch(fallback);
      } catch {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new SipApiError(504, {
            code: 'INTERNAL_ERROR',
            message: MSG_TIMEOUT,
            status: 504,
          });
        }
        throw new SipApiError(503, {
          code: 'INTERNAL_ERROR',
          message: 'SIP API недоступен. Проверьте backend/proxy.',
          status: 503,
        });
      }
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SipApiError(504, {
        code: 'INTERNAL_ERROR',
        message: MSG_TIMEOUT,
        status: 504,
      });
    } else {
      throw new SipApiError(503, {
        code: 'INTERNAL_ERROR',
        message: 'SIP API недоступен. Проверьте backend/proxy.',
        status: 503,
      });
    }
  }
  const text = await r.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!r.ok) {
    const apiBody = apiErrorBodyFromResponse(body, r);
    throw new SipApiError(r.status, apiBody);
  }
  return body as T;
}

/** Разбор тела ошибки API; экспорт для тестов регрессии (пустое тело / JSON `null`). */
export function apiErrorBodyFromResponse(body: unknown, r: Response): ApiErrorBody {
  const b =
    body !== null && typeof body === 'object'
      ? (body as Partial<ApiErrorBody>)
      : ({} as Partial<ApiErrorBody>);
  return {
    code: (b.code as ApiErrorBody['code']) ?? 'INTERNAL_ERROR',
    message: typeof b.message === 'string' ? b.message : r.statusText,
    status: typeof b.status === 'number' ? b.status : r.status,
    details: b.details,
    requestId: b.requestId,
  };
}

/**
 * POST с `FormData` (без принудительного Content-Type — задаётся boundary браузером).
 */
export async function fetchFormDataJson<T>(path: string, formData: FormData): Promise<T> {
  const sip = sipUserHeaders();
  async function doFetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: sip,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  let r: Response;
  try {
    r = await doFetch(apiUrl(path));
  } catch (error) {
    const fallback = fallbackApiUrl(path);
    if (fallback) {
      try {
        r = await doFetch(fallback);
      } catch {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new SipApiError(504, {
            code: 'INTERNAL_ERROR',
            message:
              'Загрузка не завершилась вовремя (timeout). Увеличьте VITE_SIP_API_UPLOAD_TIMEOUT_MS в .env или проверьте сеть и API.',
            status: 504,
          });
        }
        throw new SipApiError(503, {
          code: 'INTERNAL_ERROR',
          message: 'SIP API недоступен. Проверьте backend/proxy.',
          status: 503,
        });
      }
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SipApiError(504, {
        code: 'INTERNAL_ERROR',
        message:
          'Загрузка не завершилась вовремя (timeout). Увеличьте VITE_SIP_API_UPLOAD_TIMEOUT_MS в .env или проверьте сеть и API.',
        status: 504,
      });
    } else {
      throw new SipApiError(503, {
        code: 'INTERNAL_ERROR',
        message: 'SIP API недоступен. Проверьте backend/proxy.',
        status: 503,
      });
    }
  }
  const text = await r.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!r.ok) {
    const apiBody = apiErrorBodyFromResponse(body, r);
    throw new SipApiError(r.status, apiBody);
  }
  return body as T;
}
