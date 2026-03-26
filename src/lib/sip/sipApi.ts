import { auth } from '../firebase/auth';
import type { SipProjectRow } from './sipTypes';
import { getSipApiBase } from './sipEnv';

const SIP_API_TIMEOUT_MS = 15000;

export class SipApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'SipApiError';
  }
}

interface SipApiErrorPayload {
  message?: string;
  code?: string;
  requestId?: string;
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `crm-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatErrorMessage(message: string, requestId?: string): string {
  return requestId ? `${message} (requestId: ${requestId})` : message;
}

async function parseJsonBody<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 120).trim();
    throw new SipApiError(
      snippet.startsWith('<')
        ? 'API вернул HTML вместо JSON. Проверьте VITE_SIP_API_BASE_URL и Netlify redirects.'
        : 'Некорректный ответ API (не JSON).',
      res.status || 500,
      'INVALID_API_RESPONSE'
    );
  }
}

async function sipFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new SipApiError('Войдите в CRM', 401, 'UNAUTHORIZED');
  }
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('x-request-id', makeRequestId());
  headers.set('x-sip-user-id', user.uid);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getSipApiBase();
  const url = `${base}${normalizedPath}`;
  const fallbackUrl =
    !base.startsWith('/') && normalizedPath.startsWith('/api/')
      ? `/sip-editor-api${normalizedPath}`
      : null;

  async function doFetch(requestUrl: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SIP_API_TIMEOUT_MS);
    try {
      return await fetch(requestUrl, { ...init, headers, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  try {
    return await doFetch(url);
  } catch (error) {
    if (fallbackUrl) {
      try {
        return await doFetch(fallbackUrl);
      } catch {
        // keep original error semantics below
      }
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SipApiError(
        'SIP API не ответил вовремя. Повторите позже или проверьте доступность api.2wix.ru.',
        504,
        'GATEWAY_TIMEOUT'
      );
    }
    if (error instanceof TypeError) {
      throw new SipApiError(
        'Нет соединения с SIP API (network/CORS/SSL). Проверьте доступность api.2wix.ru и proxy /sip-editor-api.',
        503,
        'NETWORK_UNREACHABLE'
      );
    }
    throw new SipApiError('Неизвестная ошибка сети при обращении к SIP API.', 503, 'NETWORK_ERROR');
  }
}

export async function sipListProjects(limit = 60): Promise<SipProjectRow[]> {
  const res = await sipFetch(`/api/projects?limit=${limit}`);
  const data = await parseJsonBody<{ projects?: SipProjectRow[] } & SipApiErrorPayload>(res);
  if (!res.ok) {
    const msg = data?.message ?? `Ошибка ${res.status}`;
    throw new SipApiError(formatErrorMessage(msg, data?.requestId), res.status, data?.code, data?.requestId);
  }
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function sipGetProject(projectId: string): Promise<SipProjectRow> {
  const id = projectId.trim();
  const res = await sipFetch(`/api/projects/${encodeURIComponent(id)}`);
  const data =
    (await parseJsonBody<{ project?: SipProjectRow } & SipApiErrorPayload>(res)) ?? {};
  if (!res.ok) {
    const msg = data.message ?? `Ошибка ${res.status}`;
    throw new SipApiError(formatErrorMessage(msg, data.requestId), res.status, data.code, data.requestId);
  }
  if (!data.project?.id) {
    throw new SipApiError('Некорректный ответ API', res.status);
  }
  return data.project;
}

export async function sipCreateProject(input: {
  title?: string;
  dealId?: string | null;
  createdBy: string;
}): Promise<{ project: SipProjectRow }> {
  const res = await sipFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data =
    (await parseJsonBody<{ project?: SipProjectRow } & SipApiErrorPayload>(res)) ?? {};
  if (!res.ok) {
    if (res.status === 401) {
      throw new SipApiError(
        formatErrorMessage('Нет авторизации для SIP API (401).', data.requestId),
        401,
        data.code ?? 'UNAUTHORIZED',
        data.requestId
      );
    }
    if (res.status === 403) {
      throw new SipApiError(
        formatErrorMessage('Доступ к SIP API запрещён (403).', data.requestId),
        403,
        data.code ?? 'FORBIDDEN',
        data.requestId
      );
    }
    if (res.status === 404) {
      throw new SipApiError(
        formatErrorMessage('Route SIP API не найден (404). Проверьте proxy/rewrite /sip-editor-api/*.', data.requestId),
        404,
        data.code ?? 'NOT_FOUND',
        data.requestId
      );
    }
    if (res.status === 504) {
      throw new SipApiError(
        formatErrorMessage('SIP API временно недоступен (504). Проект не создан, попробуйте позже.', data.requestId),
        504,
        data.code ?? 'GATEWAY_TIMEOUT',
        data.requestId
      );
    }
    if (res.status >= 500) {
      throw new SipApiError(
        formatErrorMessage(`SIP API вернул ${res.status}. Ошибка backend/runtime.`, data.requestId),
        res.status,
        data.code ?? 'INTERNAL_ERROR',
        data.requestId
      );
    }
    const msg = data.message ?? `Ошибка ${res.status}`;
    throw new SipApiError(formatErrorMessage(msg, data.requestId), res.status, data.code, data.requestId);
  }
  if (!data.project?.id) {
    throw new SipApiError('Некорректный ответ API', res.status);
  }
  return { project: data.project };
}
