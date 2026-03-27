import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sip-editor http api base (Netlify / Cloud Run)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('apiUrl prefixes /api with /sip-editor-api when VITE_API_BASE_URL is set for Netlify proxy', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/sip-editor-api');
    const { apiUrl } = await import('./http');
    expect(apiUrl('/api/projects/p1/current-version')).toBe(
      '/sip-editor-api/api/projects/p1/current-version'
    );
  });

  it('apiUrl keeps dev-style /api path when base is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { apiUrl } = await import('./http');
    expect(apiUrl('/api/projects/p1/current-version')).toBe('/api/projects/p1/current-version');
  });
});
