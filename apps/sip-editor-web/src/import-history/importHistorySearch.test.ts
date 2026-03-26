import { describe, expect, it } from 'vitest';
import { searchImportHistoryItems } from './importHistorySearch';
import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

const items: ImportApplyHistoryViewItem[] = [
  {
    id: 'v1',
    appliedAt: '2026-03-26T12:00:00.000Z',
    appliedBy: 'Alice',
    importJobId: 'ij-alpha',
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
  },
  {
    id: 'v2',
    appliedAt: '2026-03-26T10:00:00.000Z',
    appliedBy: 'Bob',
    importJobId: 'ij-bravo',
    mapperVersion: 'm',
    reviewedSnapshotVersion: 'r',
    warningsCount: 0,
    traceCount: 0,
    isLegacy: true,
    isIncomplete: false,
    missingFields: [],
    missingFieldUiItems: [],
    missingFieldsCompact: '',
    badgeKind: 'warning',
    badgeLabel: 'Legacy',
    subtitle: '',
    isInspectable: false,
  },
];

describe('importHistorySearch', () => {
  it('searches by importJobId case-insensitively', () => {
    expect(searchImportHistoryItems(items, 'ALPHA').map((x) => x.id)).toEqual(['v1']);
  });

  it('searches by appliedBy case-insensitively', () => {
    expect(searchImportHistoryItems(items, 'bob').map((x) => x.id)).toEqual(['v2']);
  });
});
