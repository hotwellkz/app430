import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

export type ImportHistorySortMode = 'newest' | 'oldest';

export function sortImportHistoryItems(
  items: ImportApplyHistoryViewItem[],
  mode: ImportHistorySortMode
): ImportApplyHistoryViewItem[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()
  );
  return mode === 'oldest' ? sorted : sorted.reverse();
}
