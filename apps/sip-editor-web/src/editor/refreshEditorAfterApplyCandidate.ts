import type { ProjectVersion } from '@2wix/shared-types';
import type { QueryClient } from '@tanstack/react-query';
import { getCurrentVersion, getImportApplyHistory } from '@/api/projectsApi';
import { mapImportApplyHistoryToView } from '@/import-history/importApplyHistoryViewModel';

export interface RefreshEditorAfterApplyCandidateOptions {
  /**
   * После обновления кэша текущей версии — например increment `syncToken` в EditorShell,
   * чтобы гарантированно перезапустить `loadDocumentFromServer` вместе с эффектом по данным запроса.
   */
  onCacheUpdated?: () => void;
}

/**
 * После успешного apply-candidate: подтянуть актуальную current-version, обновить связанные запросы,
 * историю apply, не делая полного reload страницы.
 *
 * Возвращает **актуальную** `ProjectVersion` из ответа API — её нужно передать в `loadDocumentFromServer`,
 * иначе при неизменных id/versionNumber/schemaVersion React может не перезапустить эффект инициализации
 * редактора, хотя `buildingModel` на сервере уже обновился.
 */
export async function refreshEditorAfterApplyCandidate(
  queryClient: QueryClient,
  projectId: string,
  options?: RefreshEditorAfterApplyCandidateOptions
): Promise<ProjectVersion> {
  const { version } = await queryClient.fetchQuery({
    queryKey: ['sip-current-version', projectId],
    queryFn: () => getCurrentVersion(projectId),
  });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['sip-project', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['sip-versions', projectId] }),
  ]);

  await queryClient.fetchQuery({
    queryKey: ['sip-import-apply-history', projectId],
    queryFn: async () => {
      const response = await getImportApplyHistory(projectId);
      return { items: mapImportApplyHistoryToView(response.items) };
    },
  });

  options?.onCacheUpdated?.();
  return version;
}
