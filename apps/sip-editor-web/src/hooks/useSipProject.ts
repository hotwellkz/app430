import { useQuery } from '@tanstack/react-query';
import { getCurrentVersion, getProject, listVersions } from '@/api/projectsApi';

export function useSipProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sip-project', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) throw new Error('projectId обязателен');
      return getProject(projectId);
    },
  });
}

export function useSipCurrentVersion(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sip-current-version', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) throw new Error('projectId обязателен');
      return getCurrentVersion(projectId);
    },
  });
}

export function useSipVersionsList(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['sip-versions', projectId],
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      if (!projectId) throw new Error('projectId обязателен');
      return listVersions(projectId);
    },
  });
}
