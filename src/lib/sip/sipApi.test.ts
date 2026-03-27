/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sipDeleteProject } from './sipApi';

vi.mock('../firebase/auth', () => ({
  auth: { currentUser: { uid: 'user-1' } },
}));

const getSipApiBase = vi.fn(() => 'https://legacy.run.app');

vi.mock('./sipEnv', () => ({
  getSipApiBase: () => getSipApiBase(),
}));

describe('sipApi sipFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSipApiBase.mockReturnValue('https://legacy.run.app');
  });

  it('при 404 на абсолютном base повторяет запрос через /sip-editor-api', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"Route DELETE:... not found"}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true, projectId: 'p1' }), { status: 200 }));

    global.fetch = fetchMock as typeof fetch;

    await sipDeleteProject('p1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://legacy.run.app/api/projects/p1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/sip-editor-api/api/projects/p1');
  });

  it('при относительном base не дублирует запрос на 404', async () => {
    getSipApiBase.mockReturnValue('/sip-editor-api');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"not found"}', { status: 404 }));

    global.fetch = fetchMock as typeof fetch;

    await expect(sipDeleteProject('p1')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
