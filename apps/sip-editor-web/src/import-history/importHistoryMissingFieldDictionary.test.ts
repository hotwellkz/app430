import { describe, expect, it } from 'vitest';
import { resolveMissingFieldEntry } from './importHistoryMissingFieldDictionary';

describe('importHistoryMissingFieldDictionary', () => {
  it('returns label and hint from dictionary for known key', () => {
    const entry = resolveMissingFieldEntry('mapperVersion');
    expect(entry?.label).toBe('Версия mapper');
    expect(entry?.hint).toContain('reviewed snapshot');
  });

  it('returns null for unknown key', () => {
    expect(resolveMissingFieldEntry('unknown_key')).toBeNull();
  });
});
