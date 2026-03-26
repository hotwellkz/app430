import { describe, expect, it } from 'vitest';
import { evaluateVersionConcurrency } from './concurrency.js';

describe('evaluateVersionConcurrency', () => {
  const base = {
    serverCurrentVersionId: 'v1',
    serverVersionNumber: 2,
    serverSchemaVersion: 1,
    serverUpdatedAtIso: '2025-01-01T00:00:00.000Z',
  };

  it('returns null when expectations match server', () => {
    expect(
      evaluateVersionConcurrency({
        expectedCurrentVersionId: 'v1',
        expectedVersionNumber: 2,
        expectedSchemaVersion: 1,
        ...base,
      })
    ).toBeNull();
  });

  it('returns conflict when version id differs', () => {
    const c = evaluateVersionConcurrency({
      expectedCurrentVersionId: 'v-old',
      expectedVersionNumber: 2,
      expectedSchemaVersion: 1,
      ...base,
    });
    expect(c).not.toBeNull();
    expect(c?.currentVersionId).toBe('v1');
    expect(c?.currentVersionNumber).toBe(2);
  });

  it('returns conflict when version number differs', () => {
    const c = evaluateVersionConcurrency({
      expectedCurrentVersionId: 'v1',
      expectedVersionNumber: 1,
      expectedSchemaVersion: 1,
      ...base,
    });
    expect(c).not.toBeNull();
  });

  it('returns conflict when schema version differs', () => {
    const c = evaluateVersionConcurrency({
      expectedCurrentVersionId: 'v1',
      expectedVersionNumber: 2,
      expectedSchemaVersion: 99,
      ...base,
    });
    expect(c).not.toBeNull();
  });
});
