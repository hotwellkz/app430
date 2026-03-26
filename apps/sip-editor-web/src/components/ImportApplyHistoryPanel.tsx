import { useImportApplyHistory } from '../hooks/useImportApplyHistory';
import { ImportApplyHistoryPanelView } from './ImportApplyHistoryPanelView';
import { useMemo, useState } from 'react';
import {
  filterImportApplyHistoryItems,
  type ImportHistoryFilter,
} from '../import-history/importHistoryFilters';
import { computeImportHistoryCounters } from '../import-history/importHistoryCounts';
import { searchImportHistoryItems } from '../import-history/importHistorySearch';
import {
  sortImportHistoryItems,
  type ImportHistorySortMode,
} from '../import-history/importHistorySort';

export function ImportApplyHistoryPanel({ projectId }: { projectId: string }) {
  const query = useImportApplyHistory(projectId);
  const [filter, setFilter] = useState<ImportHistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ImportHistorySortMode>('newest');
  const items = query.data?.items ?? [];
  const counters = useMemo(() => computeImportHistoryCounters(items), [items]);
  const filteredItems = useMemo(() => {
    const base = filterImportApplyHistoryItems(items, filter);
    const searched = searchImportHistoryItems(base, searchQuery);
    return sortImportHistoryItems(searched, sortMode);
  }, [items, filter, searchQuery, sortMode]);
  return (
    <ImportApplyHistoryPanelView
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessage={query.error instanceof Error ? query.error.message : null}
      items={filteredItems}
      totalCount={items.length}
      counters={counters}
      activeFilter={filter}
      onFilterChange={setFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      sortMode={sortMode}
      onSortModeChange={setSortMode}
      onRetry={() => void query.refetch()}
    />
  );
}
