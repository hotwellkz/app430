import type { ImportApplyHistoryViewItem } from './importApplyHistoryViewModel';
import type { ImportHistoryFilter } from './importHistoryFilters';

export type ImportHistoryCounters = Record<ImportHistoryFilter, number>;

export function computeImportHistoryCounters(
  items: ImportApplyHistoryViewItem[]
): ImportHistoryCounters {
  return {
    all: items.length,
    normal: items.filter((x) => !x.isLegacy).length,
    legacy: items.filter((x) => x.isLegacy).length,
    incomplete: items.filter((x) => x.isLegacy && x.isIncomplete).length,
  };
}
