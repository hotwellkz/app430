import { auth } from '../firebase/auth';
import type { SipProjectRow } from './sipTypes';

const SIP_API_TIMEOUT_MS = 15000;

function sipApiBase(): string {
  const env = import.meta.env.VITE_SIP_API_BASE_URL as string | undefined;
  if (typeof env === 'string' && env.trim()) {
    return env.replace(/\/$/, '');
  }
  return '/sip-editor-api';
}

export class SipApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'SipApiError';
  }
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
  headers.set('x-sip-user-id', user.uid);
  const url = `${sipApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SIP_API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SipApiError(
        'SIP API не ответил вовремя. Повторите позже или проверьте доступность api.2wix.ru.',
        504,
        'GATEWAY_TIMEOUT'
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function sipListProjects(limit = 60): Promise<SipProjectRow[]> {
  const res = await sipFetch(`/api/projects?limit=${limit}`);
  const data = await parseJsonBody<{ projects?: SipProjectRow[]; message?: string; code?: string }>(res);
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    let code: string | undefined;
    if (data?.message) msg = data.message;
    code = data?.code;
    throw new SipApiError(msg, res.status, code);
  }
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function sipGetProject(projectId: string): Promise<SipProjectRow> {
  const id = projectId.trim();
  const res = await sipFetch(`/api/projects/${encodeURIComponent(id)}`);
  const data =
    (await parseJsonBody<{ project?: SipProjectRow; message?: string; code?: string }>(res)) ?? {};
  if (!res.ok) {
    throw new SipApiError(data.message ?? `Ошибка ${res.status}`, res.status, data.code);
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
    (await parseJsonBody<{ project?: SipProjectRow; message?: string; code?: string }>(res)) ?? {};
  if (!res.ok) {
    if (res.status === 504) {
      throw new SipApiError(
        'SIP API временно недоступен (504). Проект не создан, попробуйте позже.',
        504,
        data.code ?? 'GATEWAY_TIMEOUT'
      );
    }
    throw new SipApiError(data.message ?? `Ошибка ${res.status}`, res.status, data.code);
  }
  if (!data.project?.id) {
    throw new SipApiError('Некорректный ответ API', res.status);
  }
  return { project: data.project };
}
