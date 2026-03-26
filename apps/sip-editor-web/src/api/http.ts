import type { ApiErrorBody } from '@2wix/shared-types';
import { sipUserHeaders } from '@/identity/sipUser';

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const API_TIMEOUT_MS = 15000;

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(apiUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...sip,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SipApiError(504, {
        code: 'INTERNAL_ERROR',
        message: 'SIP API не ответил вовремя (timeout). Проверьте backend/proxy.',
        status: 504,
      });
    }
    throw new SipApiError(503, {
      code: 'INTERNAL_ERROR',
      message: 'SIP API недоступен. Проверьте backend/proxy.',
      status: 503,
    });
  } finally {
    window.clearTimeout(timeout);
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
    const b = body as Partial<ApiErrorBody>;
    const apiBody: ApiErrorBody = {
      code: (b.code as ApiErrorBody['code']) ?? 'INTERNAL_ERROR',
      message: typeof b.message === 'string' ? b.message : r.statusText,
      status: typeof b.status === 'number' ? b.status : r.status,
      details: b.details,
      requestId: b.requestId,
    };
    throw new SipApiError(r.status, apiBody);
  }
  return body as T;
}
