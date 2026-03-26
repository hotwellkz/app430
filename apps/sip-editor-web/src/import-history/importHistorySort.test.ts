import { describe, expect, it } from 'vitest';
import { sortImportHistoryItems } from './importHistorySort';
import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

function item(id: string, appliedAt: string): ImportApplyHistoryViewItem {
  return {
    id,
    appliedAt,
    appliedBy: 'u1',
    importJobId: 'ij',
    mapperVersion: 'm',
    reviewedSnapshotVersion: 'r',
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
  };
}

describe('importHistorySort', () => {
  const items = [
    item('old', '2026-03-24T10:00:00.000Z'),
    item('new', '2026-03-26T10:00:00.000Z'),
  ];
  it('sorts newest-first by default mode', () => {
    expect(sortImportHistoryItems(items, 'newest').map((x) => x.id)).toEqual(['new', 'old']);
  });
  it('sorts oldest-first for oldest mode', () => {
    expect(sortImportHistoryItems(items, 'oldest').map((x) => x.id)).toEqual(['old', 'new']);
  });
});
