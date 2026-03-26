import { describe, expect, it } from 'vitest';
import { filterImportApplyHistoryItems } from './importHistoryFilters';
import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

const base: ImportApplyHistoryViewItem = {
  id: 'v1',
  appliedAt: '2026-03-26T12:00:00.000Z',
  appliedBy: 'u1',
  importJobId: 'ij-1',
  mapperVersion: 'import-candidate-v1',
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
};

describe('importHistoryFilters', () => {
  const items: ImportApplyHistoryViewItem[] = [
    base,
    { ...base, id: 'v2', isLegacy: true, isIncomplete: false, badgeKind: 'warning', badgeLabel: 'Legacy' },
    { ...base, id: 'v3', isLegacy: true, isIncomplete: true, badgeKind: 'danger', badgeLabel: 'Incomplete legacy' },
  ];

  it('filters normal', () => {
    expect(filterImportApplyHistoryItems(items, 'normal').map((x) => x.id)).toEqual(['v1']);
  });

  it('filters legacy', () => {
    expect(filterImportApplyHistoryItems(items, 'legacy').map((x) => x.id)).toEqual(['v2', 'v3']);
  });

  it('filters incomplete', () => {
    expect(filterImportApplyHistoryItems(items, 'incomplete').map((x) => x.id)).toEqual(['v3']);
  });
});
