import { describe, expect, it, vi } from 'vitest';
import { buildCrmSipProjectsUrl, buildSipEditorUrl, openSipEditorWindow } from './sipEditorUrl';

describe('sipEditorUrl helpers', () => {
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

  it('throws in production when editor origin is missing', () => {
    expect(() => buildSipEditorUrl('p-1', 'u-1', { DEV: false, PROD: true })).toThrow(
      /SIP Editor production URL не настроен/
    );
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

  it('builds crm projects url', () => {
    const url = buildCrmSipProjectsUrl();
    expect(url.endsWith('/sip-projects') || url === '/sip-projects').toBe(true);
  });
});

