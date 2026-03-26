import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';

export function searchImportHistoryItems(
  items: ImportApplyHistoryViewItem[],
  rawQuery: string
): ImportApplyHistoryViewItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => {
    return (
      item.importJobId.toLowerCase().includes(query) ||
      item.appliedBy.toLowerCase().includes(query)
    );
  });
}
