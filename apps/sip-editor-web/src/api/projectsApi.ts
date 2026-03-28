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
  DuplicateProjectRequest,
  ExportArtifactMeta,
  GetImportApplyHistoryResponse,
  GetImportJobResponse,
  ExportPackageSnapshot,
  ImportAssetRef,
  ListImportJobsResponse,
  PatchCurrentVersionRequestBody,
  PatchProjectRequest,
  PrepareEditorApplyRequest,
  PrepareEditorApplyResponse,
  Project,
  ProjectVersion,
  ProjectWithCurrentVersion,
  SaveImportReviewRequest,
  SaveImportReviewResponse,
} from '@2wix/shared-types';
import { fetchFormDataJson, fetchJson, SipApiError } from './http';

type UnknownRecord = Record<string, unknown>;

function shouldLogOpenFlowDiagnostics(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') return true;
  try {
    return window.localStorage.getItem('sip_debug_open_flow') === '1';
  } catch {
    return false;
  }
}

function logVersionResolution(
  source: 'current-version' | 'versions-fallback',
  projectId: string,
  version: ProjectVersion
): void {
  if (!shouldLogOpenFlowDiagnostics()) return;
  const editorOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  console.info('[sip-editor:open-flow]', {
    projectId,
    source,
    resolvedVersionId: version.id,
    resolvedVersionNumber: version.versionNumber,
    editorOrigin,
  });
}

function asRecord(v: unknown): UnknownRecord | null {
  return typeof v === 'object' && v !== null ? (v as UnknownRecord) : null;
}

function extractVersionPayload(v: unknown): ProjectVersion | null {
  const root = asRecord(v);
  if (!root) return null;
  if (root.version) return root.version as ProjectVersion;
  if (root.currentVersion) return root.currentVersion as ProjectVersion;
  if (root['current-version']) return root['current-version'] as ProjectVersion;
  if (root.current_version) return root.current_version as ProjectVersion;
  if (root.item) return root.item as ProjectVersion;
  const data = asRecord(root.data);
  if (data?.version) return data.version as ProjectVersion;
  if (data?.currentVersion) return data.currentVersion as ProjectVersion;
  if (data?.['current-version']) return data['current-version'] as ProjectVersion;
  if (data?.current_version) return data.current_version as ProjectVersion;
  if (data?.item) return data.item as ProjectVersion;
  return null;
}

function extractVersionsPayload(v: unknown): ProjectVersion[] {
  const root = asRecord(v);
  if (!root) return [];
  if (Array.isArray(root.versions)) return root.versions as ProjectVersion[];
  if (Array.isArray(root.items)) return root.items as ProjectVersion[];
  const data = asRecord(root.data);
  if (Array.isArray(data?.versions)) return data.versions as ProjectVersion[];
  if (Array.isArray(data?.items)) return data.items as ProjectVersion[];
  return [];
}

export async function getProject(projectId: string): Promise<{ project: Project }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
}

export async function getCurrentVersion(
  projectId: string
): Promise<{ version: ProjectVersion }> {
  let primary: unknown = null;
  try {
    primary = await fetchJson<unknown>(`/api/projects/${encodeURIComponent(projectId)}/current-version`);
    const direct = extractVersionPayload(primary);
    if (direct) {
      logVersionResolution('current-version', projectId, direct);
      return { version: direct };
    }
  } catch (error) {
    if (!(error instanceof SipApiError) || error.status !== 404) {
      throw error;
    }
  }

  // Fallback for inconsistent contracts in old environments:
  // if /current-version answered without version payload, pick latest from /versions.
  const fallback = await fetchJson<unknown>(`/api/projects/${encodeURIComponent(projectId)}/versions`);
  const candidate = extractVersionsPayload(fallback)[0] ?? null;
  if (candidate) {
    logVersionResolution('versions-fallback', projectId, candidate);
    return { version: candidate };
  }
  throw new Error('Ответ сервера не содержит данные current-version для этого проекта.');
}

export async function listVersions(
  projectId: string
): Promise<{ versions: ProjectVersion[] }> {
  const raw = await fetchJson<unknown>(`/api/projects/${encodeURIComponent(projectId)}/versions`);
  return { versions: extractVersionsPayload(raw) };
}

export async function createProject(
  body: CreateProjectRequest
): Promise<ProjectWithCurrentVersion> {
  return fetchJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listProjects(params?: {
  limit?: number;
  templates?: 'all' | 'only' | 'hide';
}): Promise<{ projects: Project[] }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.templates && params.templates !== 'all') q.set('templates', params.templates);
  const qs = q.toString();
  return fetchJson(`/api/projects${qs ? `?${qs}` : ''}`);
}

export async function duplicateProject(
  projectId: string,
  body: DuplicateProjectRequest
): Promise<ProjectWithCurrentVersion> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchProject(
  projectId: string,
  body: PatchProjectRequest
): Promise<{ project: Project }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
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

/** Загрузка одного растрового файла в Firebase Storage; возвращает ref для create-import (без base64 в JSON). */
export async function uploadImportSourceFile(
  projectId: string,
  params: { file: File; id: string; kind: ImportAssetRef['kind'] }
): Promise<{ asset: ImportAssetRef }> {
  const form = new FormData();
  form.append('file', params.file);
  form.append('id', params.id);
  form.append('kind', params.kind);
  return fetchFormDataJson(
    `/api/projects/${encodeURIComponent(projectId)}/import-sources`,
    form
  );
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
