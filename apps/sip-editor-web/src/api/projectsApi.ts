import type {
  CreateExportRequest,
  CreateExportResponse,
  CreateProjectRequest,
  CreateVersionRequest,
  ExportArtifactMeta,
  ExportPackageSnapshot,
  PatchCurrentVersionRequestBody,
  Project,
  ProjectVersion,
  ProjectWithCurrentVersion,
} from '@2wix/shared-types';
import { fetchJson } from './http';

export async function getProject(projectId: string): Promise<{ project: Project }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
}

export async function getCurrentVersion(
  projectId: string
): Promise<{ version: ProjectVersion }> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/current-version`
  );
}

export async function listVersions(
  projectId: string
): Promise<{ versions: ProjectVersion[] }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/versions`);
}

export async function createProject(
  body: CreateProjectRequest
): Promise<ProjectWithCurrentVersion> {
  return fetchJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createVersion(
  projectId: string,
  body: CreateVersionRequest
): Promise<{ version: ProjectVersion }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchCurrentVersion(
  projectId: string,
  body: PatchCurrentVersionRequestBody
): Promise<{ version: ProjectVersion }> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/current-version`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
}

export async function createProjectExport(
  projectId: string,
  body: CreateExportRequest
): Promise<CreateExportResponse> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/exports`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listProjectExports(
  projectId: string
): Promise<{ exports: ExportArtifactMeta[] }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/exports`);
}

export async function getProjectExport(
  projectId: string,
  exportId: string
): Promise<{ artifact: ExportArtifactMeta; snapshot: ExportPackageSnapshot | null }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(exportId)}`);
}
