import { useImportApplyHistory } from '../hooks/useImportApplyHistory';
import { ImportApplyHistoryPanelView } from './ImportApplyHistoryPanelView';
import { useMemo, useState } from 'react';
import {
  filterImportApplyHistoryItems,
  type ImportHistoryFilter,
} from '../import-history/importHistoryFilters';

export function ImportApplyHistoryPanel({ projectId }: { projectId: string }) {
  const query = useImportApplyHistory(projectId);
  const [filter, setFilter] = useState<ImportHistoryFilter>('all');
  const items = query.data?.items ?? [];
  const filteredItems = useMemo(
    () => filterImportApplyHistoryItems(items, filter),
    [items, filter]
  );
  return (
    <ImportApplyHistoryPanelView
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessage={query.error instanceof Error ? query.error.message : null}
      items={filteredItems}
      totalCount={items.length}
      activeFilter={filter}
      onFilterChange={setFilter}
      onRetry={() => void query.refetch()}
    />
  );
}
