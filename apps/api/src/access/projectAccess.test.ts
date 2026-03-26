import { describe, expect, it } from 'vitest';
import type { Project } from '@2wix/shared-types';
import { canAccessProject } from './projectAccess.js';

function proj(p: Partial<Project>): Project {
  return {
    id: 'p1',
    dealId: null,
    title: 't',
    status: 'draft',
    currentVersionId: 'v1',
    currentVersionNumber: 1,
    schemaVersion: 1,
    createdAt: '',
    updatedAt: '',
    createdBy: 'alice',
    updatedBy: 'alice',
    ...p,
  };
}

describe('canAccessProject', () => {
  it('denies empty userId', () => {
    expect(canAccessProject(proj({}), '')).toBe(false);
  });

  it('allows creator when no allowedEditorIds', () => {
    expect(canAccessProject(proj({ createdBy: 'alice' }), 'alice')).toBe(true);
    expect(canAccessProject(proj({ createdBy: 'alice' }), 'bob')).toBe(false);
  });

  it('uses allowedEditorIds when non-empty', () => {
    expect(
      canAccessProject(
        proj({ createdBy: 'alice', allowedEditorIds: ['bob', 'carol'] }),
        'bob'
      )
    ).toBe(true);
    expect(
      canAccessProject(
        proj({ createdBy: 'alice', allowedEditorIds: ['bob'] }),
        'alice'
      )
    ).toBe(false);
  });

  it('allows any user when no owner and no list (legacy)', () => {
    expect(
      canAccessProject(
        proj({ createdBy: null, allowedEditorIds: undefined }),
        'anyone'
      )
    ).toBe(true);
  });
});
