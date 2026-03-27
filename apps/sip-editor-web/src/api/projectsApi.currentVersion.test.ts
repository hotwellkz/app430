import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentVersion } from './projectsApi';
import { SipApiError } from './http';

const fetchJsonMock = vi.fn();

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>();
  return {
    ...actual,
    fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
  };
});

describe('projectsApi.getCurrentVersion', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('accepts { version } payload', async () => {
    fetchJsonMock.mockResolvedValueOnce({ version: { id: 'v1' } });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v1');
  });

  it('accepts legacy { currentVersion } payload', async () => {
    fetchJsonMock.mockResolvedValueOnce({ currentVersion: { id: 'v2' } });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v2');
  });

  it('accepts legacy { current-version } payload', async () => {
    fetchJsonMock.mockResolvedValueOnce({ 'current-version': { id: 'v2-kebab' } });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v2-kebab');
  });

  it('accepts legacy { current_version } payload', async () => {
    fetchJsonMock.mockResolvedValueOnce({ current_version: { id: 'v2-snake' } });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v2-snake');
  });

  it('accepts legacy { item } payload', async () => {
    fetchJsonMock.mockResolvedValueOnce({ item: { id: 'v-item' } });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v-item');
  });

  it('falls back to /versions when current-version payload is malformed', async () => {
    fetchJsonMock.mockResolvedValueOnce({});
    fetchJsonMock.mockResolvedValueOnce({ versions: [{ id: 'v3' }] });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v3');
    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
  });

  it('uses fallback when /versions returns { items } shape', async () => {
    fetchJsonMock.mockResolvedValueOnce({});
    fetchJsonMock.mockResolvedValueOnce({ items: [{ id: 'v-items' }] });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v-items');
  });

  it('does not crash when /versions response shape is malformed', async () => {
    fetchJsonMock.mockResolvedValueOnce({});
    fetchJsonMock.mockResolvedValueOnce({});
    await expect(getCurrentVersion('p1')).rejects.toThrow(
      'Ответ сервера не содержит данные current-version для этого проекта.'
    );
  });

  it('falls back to /versions when /current-version returns 404', async () => {
    fetchJsonMock.mockRejectedValueOnce(
      new SipApiError(404, {
        code: 'NOT_FOUND',
        message: 'Текущая версия не назначена',
        status: 404,
      })
    );
    fetchJsonMock.mockResolvedValueOnce({ versions: [{ id: 'v404' }] });
    const res = await getCurrentVersion('p1');
    expect((res.version as { id: string }).id).toBe('v404');
  });
});
