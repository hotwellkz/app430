import { auth } from '../firebase/auth';
import type { SipProjectRow } from './sipTypes';

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
  return fetch(url, { ...init, headers });
}

export async function sipListProjects(limit = 60): Promise<SipProjectRow[]> {
  const res = await sipFetch(`/api/projects?limit=${limit}`);
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    let code: string | undefined;
    try {
      const j = (await res.json()) as { message?: string; code?: string };
      if (j.message) msg = j.message;
      code = j.code;
    } catch {
      /* ignore */
    }
    throw new SipApiError(msg, res.status, code);
  }
  const data = (await res.json()) as { projects?: SipProjectRow[] };
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function sipGetProject(projectId: string): Promise<SipProjectRow> {
  const id = projectId.trim();
  const res = await sipFetch(`/api/projects/${encodeURIComponent(id)}`);
  const data = (await res.json()) as { project?: SipProjectRow; message?: string; code?: string };
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
  const data = (await res.json()) as { project?: SipProjectRow; message?: string; code?: string };
  if (!res.ok) {
    throw new SipApiError(data.message ?? `Ошибка ${res.status}`, res.status, data.code);
  }
  if (!data.project?.id) {
    throw new SipApiError('Некорректный ответ API', res.status);
  }
  return { project: data.project };
}
