import { describe, expect, it } from 'vitest';
import { computeImportHistoryCounters } from './importHistoryCounts';
import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

function sample(overrides?: Partial<ImportApplyHistoryViewItem>): ImportApplyHistoryViewItem {
  return {
    id: 'v1',
    appliedAt: '2026-03-26T12:00:00.000Z',
    appliedBy: 'u1',
    importJobId: 'ij-1',
    mapperVersion: 'import-candidate-v2',
    reviewedSnapshotVersion: 'r1',
    warningsCount: 0,
    traceCount: 0,
    isLegacy: false,
    isIncomplete: false,
    missingFields: [],
    missingFieldUiItems: [],
    missingFieldsCompact: '',
    badgeKind: 'neutral',
    badgeLabel: 'AI import',
    subtitle: '',
    isInspectable: false,
    ...overrides,
  };
}

describe('importHistoryCounts', () => {
  it('computes counters for mixed list', () => {
    const result = computeImportHistoryCounters([
      sample({ id: 'n1' }),
      sample({ id: 'l1', isLegacy: true, badgeKind: 'warning', badgeLabel: 'Legacy' }),
      sample({ id: 'i1', isLegacy: true, isIncomplete: true, badgeKind: 'danger', badgeLabel: 'Incomplete legacy' }),
    ]);
    expect(result).toEqual({
      all: 3,
      normal: 1,
      legacy: 2,
      incomplete: 1,
    });
  });
});
