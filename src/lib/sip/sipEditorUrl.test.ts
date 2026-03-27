import { describe, expect, it, vi } from 'vitest';
import { buildCrmSipProjectsUrl, buildSipEditorUrl, openSipEditorWindow } from './sipEditorUrl';

describe('sipEditorUrl helpers', () => {
  function withBrowserWindow<T>(cb: () => T): T {
    const prev = (globalThis as { window?: unknown }).window;
    vi.stubGlobal('window', {
      location: { origin: 'https://2wix.ru' },
      open: vi.fn(),
    });
    try {
      return cb();
    } finally {
      if (prev === undefined) {
        vi.unstubAllGlobals();
      } else {
        vi.stubGlobal('window', prev);
      }
    }
  }

  it('builds editor url with encoded project id and uid', () => {
    const url = buildSipEditorUrl('p 1', 'u-1', {
      VITE_SIP_EDITOR_ORIGIN: 'https://2wix.ru',
      PROD: true,
      DEV: false,
    });
    expect(url.includes('/sip-editor/p%201')).toBe(true);
    expect(url.includes('sipUserId=u-1')).toBe(true);
  });

  it('uses localhost fallback only in dev', () => {
    const url = buildSipEditorUrl('p-1', 'u-1', { DEV: true, PROD: false });
    expect(url.startsWith('http://localhost:5174/sip-editor/p-1')).toBe(true);
  });

  it('falls back to CRM launch page when editor origin is missing', () => {
    const url = withBrowserWindow(() => buildSipEditorUrl('p-1', 'u-1', { DEV: false, PROD: true }));
    expect(url).toContain('/integrations/sip-editor?');
    expect(url).toContain('projectId=p-1');
    expect(url).toContain('sipUserId=u-1');
  });

  it('throws in production when editor origin points to localhost', () => {
    expect(() =>
      buildSipEditorUrl('p-1', 'u-1', {
        VITE_SIP_EDITOR_ORIGIN: 'http://localhost:5174',
        DEV: false,
        PROD: true,
      })
    ).toThrow(/localhost запрещен/);
  });

  it('open flow uses expected url and window.open args', () => {
    const openSpy = vi.fn();
    openSipEditorWindow('proj-1', 'uid-1', {
      VITE_SIP_EDITOR_ORIGIN: 'https://editor.2wix.ru',
      DEV: false,
      PROD: true,
    }, openSpy);
    expect(openSpy).toHaveBeenCalledWith(
      'https://editor.2wix.ru/sip-editor/proj-1?sipUserId=uid-1',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('uses CRM fallback when origin points to decommissioned site', () => {
    const url = withBrowserWindow(() =>
      buildSipEditorUrl('proj-2', 'uid-2', {
        VITE_SIP_EDITOR_ORIGIN: 'https://sip-editor-web-2wix-mvp.netlify.app',
        DEV: false,
        PROD: true,
      })
    );
    expect(url).toContain('/integrations/sip-editor?');
    expect(url).toContain('projectId=proj-2');
  });

  it('builds crm projects url', () => {
    const url = buildCrmSipProjectsUrl();
    expect(url.endsWith('/sip-projects') || url === '/sip-projects').toBe(true);
  });
});

