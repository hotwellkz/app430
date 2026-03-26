import { beforeEach, describe, expect, it } from 'vitest';
import {
  bootstrapSipUserFromUrl,
  rememberSipUserId,
  resolveSipUserContext,
} from './sipUser';

describe('sip user context', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/sip-editor');
  });

  it('берет uid из query и сохраняет в session', () => {
    window.history.replaceState({}, '', '/sip-editor/p1?sipUserId=u123');
    bootstrapSipUserFromUrl();
    const ctx = resolveSipUserContext();
    expect(ctx.sipUserId).toBe('u123');
    expect(ctx.source).toBe('query');
  });

  it('использует fallback из localStorage', () => {
    rememberSipUserId('u777');
    sessionStorage.clear();
    window.history.replaceState({}, '', '/sip-editor/p1');
    bootstrapSipUserFromUrl();
    const ctx = resolveSipUserContext();
    expect(ctx.sipUserId).toBe('u777');
    expect(ctx.source === 'session' || ctx.source === 'localStorage').toBe(true);
  });
});

