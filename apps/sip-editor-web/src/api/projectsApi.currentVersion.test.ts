import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentVersion } from './projectsApi';

const fetchJsonMock = vi.fn();

vi.mock('./http', () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

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
});
