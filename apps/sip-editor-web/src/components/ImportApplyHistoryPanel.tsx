import { useImportApplyHistory } from '../hooks/useImportApplyHistory';
import { ImportApplyHistoryPanelView } from './ImportApplyHistoryPanelView';

export function ImportApplyHistoryPanel({ projectId }: { projectId: string }) {
  const query = useImportApplyHistory(projectId);
  return (
    <ImportApplyHistoryPanelView
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessage={query.error instanceof Error ? query.error.message : null}
      items={query.data?.items ?? []}
      onRetry={() => void query.refetch()}
    />
  );
}
