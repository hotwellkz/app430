import { describe, expect, it } from 'vitest';
import { buildCrmSipProjectsUrl, buildSipEditorUrl } from './sipEditorUrl';

describe('sipEditorUrl helpers', () => {
  it('builds editor url with encoded project id and uid', () => {
    const url = buildSipEditorUrl('p 1', 'u-1');
    expect(url.includes('/sip-editor/p%201')).toBe(true);
    expect(url.includes('sipUserId=u-1')).toBe(true);
  });

  it('builds crm projects url', () => {
    const url = buildCrmSipProjectsUrl();
    expect(url.endsWith('/sip-projects') || url === '/sip-projects').toBe(true);
  });
});

