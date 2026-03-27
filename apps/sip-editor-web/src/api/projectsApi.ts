import type {
  ApplyCandidateToProjectRequest,
  ApplyCandidateToProjectResponse,
  ApplyImportReviewRequest,
  ApplyImportReviewResponse,
  CreateExportRequest,
  CreateExportResponse,
  CreateImportJobRequest,
  CreateImportJobResponse,
  CreateProjectRequest,
  CreateVersionRequest,
  ExportArtifactMeta,
  GetImportApplyHistoryResponse,
  GetImportJobResponse,
  ExportPackageSnapshot,
  ListImportJobsResponse,
  PatchCurrentVersionRequestBody,
  PrepareEditorApplyRequest,
  PrepareEditorApplyResponse,
  Project,
  ProjectVersion,
  ProjectWithCurrentVersion,
  SaveImportReviewRequest,
  SaveImportReviewResponse,
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

export async function getProjectExportDownloadUrl(
  projectId: string,
  exportId: string
): Promise<{ url: string; fileName: string }> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(exportId)}/download`
  );
}

export async function getImportApplyHistory(
  projectId: string
): Promise<GetImportApplyHistoryResponse> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/import-apply-history`);
}

export async function listImportJobs(
  projectId: string
): Promise<ListImportJobsResponse> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/import-jobs`);
}

export async function createImportJob(
  projectId: string,
  body: CreateImportJobRequest
): Promise<CreateImportJobResponse> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/import-jobs`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getImportJob(
  projectId: string,
  jobId: string
): Promise<GetImportJobResponse> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-jobs/${encodeURIComponent(jobId)}`
  );
}

export async function saveImportJobReview(
  projectId: string,
  jobId: string,
  body: SaveImportReviewRequest
): Promise<SaveImportReviewResponse> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-jobs/${encodeURIComponent(jobId)}/review`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function applyImportJobReview(
  projectId: string,
  jobId: string,
  body: ApplyImportReviewRequest
): Promise<ApplyImportReviewResponse> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-jobs/${encodeURIComponent(jobId)}/apply-review`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function prepareImportJobEditorApply(
  projectId: string,
  jobId: string,
  body: PrepareEditorApplyRequest
): Promise<PrepareEditorApplyResponse> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-jobs/${encodeURIComponent(jobId)}/prepare-editor-apply`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function applyImportJobCandidateToProject(
  projectId: string,
  jobId: string,
  body: ApplyCandidateToProjectRequest
): Promise<ApplyCandidateToProjectResponse> {
  return fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-jobs/${encodeURIComponent(jobId)}/apply-candidate`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}
