import { describe, expect, it } from 'vitest';
import { classifyImportApplyHistoryVersion } from './historyClassifier.js';

describe('classifyImportApplyHistoryVersion', () => {
  it('maps valid provenance to normal history item', () => {
    const result = classifyImportApplyHistoryVersion({
      versionId: 'v1',
      versionNumberRaw: 7,
      importProvenanceRaw: {
        sourceKind: 'ai_import',
        importJobId: 'ij-1',
        mapperVersion: 'import-candidate-v1',
        reviewedSnapshotVersion: 'r1',
        appliedBy: 'u1',
        appliedAt: '2026-03-26T12:00:00.000Z',
        warningsCount: 1,
        traceCount: 2,
        note: 'ok',
      },
    });
    expect(result.isLegacyDetected).toBe(false);
    expect(result.item?.isLegacy).toBeUndefined();
    expect(result.item?.versionId).toBe('v1');
    expect(result.item?.importJobId).toBe('ij-1');
  });

  it('maps incomplete provenance to safe legacy item with missingFields', () => {
    const result = classifyImportApplyHistoryVersion({
      versionId: 'v-legacy',
      versionNumberRaw: 3,
      importProvenanceRaw: {
        sourceKind: 'ai_import',
        importJobId: 'ij-legacy',
      },
      nowIso: () => '2026-03-26T00:00:00.000Z',
    });
    expect(result.isLegacyDetected).toBe(true);
    expect(result.item?.isLegacy).toBe(true);
    expect(result.item?.isIncomplete).toBe(true);
    expect(result.item?.appliedAt).toBe('2026-03-26T00:00:00.000Z');
    expect(result.item?.missingFields).toEqual(
      expect.arrayContaining(['mapperVersion', 'reviewedSnapshotVersion', 'appliedBy', 'appliedAt'])
    );
  });

  it('returns null for no provenance', () => {
    const result = classifyImportApplyHistoryVersion({
      versionId: 'v-empty',
      versionNumberRaw: 1,
      importProvenanceRaw: null,
    });
    expect(result.item).toBeNull();
    expect(result.isLegacyDetected).toBe(false);
  });

  it('returns null for unrelated provenance source', () => {
    const result = classifyImportApplyHistoryVersion({
      versionId: 'v-unrelated',
      versionNumberRaw: 1,
      importProvenanceRaw: { sourceKind: 'manual' },
    });
    expect(result.item).toBeNull();
    expect(result.isLegacyDetected).toBe(false);
  });
});
