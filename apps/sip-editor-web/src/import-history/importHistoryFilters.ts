import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

export type ImportHistoryFilter = 'all' | 'normal' | 'legacy' | 'incomplete';

export function filterImportApplyHistoryItems(
  items: ImportApplyHistoryViewItem[],
  filter: ImportHistoryFilter
): ImportApplyHistoryViewItem[] {
  if (filter === 'all') return items;
  if (filter === 'normal') return items.filter((x) => !x.isLegacy);
  if (filter === 'legacy') return items.filter((x) => x.isLegacy);
  return items.filter((x) => x.isLegacy && x.isIncomplete);
}
