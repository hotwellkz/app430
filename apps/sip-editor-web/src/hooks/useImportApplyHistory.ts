import { useQuery } from '@tanstack/react-query';
import { getImportApplyHistory } from '../api/projectsApi';
import {
  mapImportApplyHistoryToView,
  type ImportApplyHistoryViewItem,
} from '../import-history/importApplyHistoryViewModel';

export interface UseImportApplyHistoryResult {
  items: ImportApplyHistoryViewItem[];
}

export function useImportApplyHistory(projectId: string | undefined) {
  return useQuery<UseImportApplyHistoryResult>({
    queryKey: ['sip-import-apply-history', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) throw new Error('projectId обязателен');
      const response = await getImportApplyHistory(projectId);
      return {
        items: mapImportApplyHistoryToView(response.items),
      };
    },
  });
}
