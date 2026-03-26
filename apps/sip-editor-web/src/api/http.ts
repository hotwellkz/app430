import type { ApiErrorBody } from '@2wix/shared-types';
import { sipUserHeaders } from '@/identity/sipUser';

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

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
  const r = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...sip,
      ...(init?.headers ?? {}),
    },
  });
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
      details: b.details,
      requestId: b.requestId,
    };
    throw new SipApiError(r.status, apiBody);
  }
  return body as T;
}
