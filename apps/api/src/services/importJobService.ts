import { FieldValue } from 'firebase-admin/firestore';
import type {
  ApplyCandidateToProjectResponse,
  ArchitecturalImportSnapshot,
  ApplyImportReviewResponse,
  BuildingModelCandidate,
  CandidateApplySummary,
  CreateImportJobRequest,
  CreateImportJobResponse,
  ImportEditorApplyState,
  ImportJob,
  ImportRequiredDecision,
  ImportReviewState,
  ImportJobStatus,
  ImportProjectApplyState,
  ImportApplyHistoryItem,
  GetImportApplyHistoryResponse,
  VersionImportProvenance,
  ImportUserDecisionSet,
  ListImportJobsResponse,
  PrepareEditorApplyResponse,
  ReviewedArchitecturalSnapshot,
  SaveImportReviewResponse,
} from '@2wix/shared-types';
import { COLLECTIONS } from '../config/collections.js';
import { AppHttpError, NotFoundError, ValidationAppError, VersionConflictError } from '../errors/httpErrors.js';
import { getDb } from '../firestore/admin.js';
import { mapImportJobDoc } from '../mappers/firestoreMappers.js';
import { getInternalWallCandidatesFromSnapshot } from './import/internalWallCandidates.js';
import {
  formatZodError,
  zApplyImportReviewBody,
  zApplyCandidateToProjectBody,
  zArchitecturalImportSnapshot,
  zCreateImportJobBody,
  zPrepareEditorApplyBody,
  zReviewedArchitecturalSnapshot,
  zSaveImportReviewBody,
  zVersionImportProvenance,
} from '../validation/schemas.js';
import { getCurrentVersion, getProject, patchCurrentVersion } from './sipProjectService.js';
import type { ArchitecturalExtractorAdapter } from './import/extractorAdapter.js';
import { resolveExtractorAdapter } from './import/resolveExtractorAdapter.js';
import type { ImportJobRunner } from './import/importJobRunner.js';
import { resolveImportJobRunner } from './import/resolveImportJobRunner.js';
import {
  buildBuildingModelCandidateFromReviewedSnapshot,
  IMPORT_CANDIDATE_MAPPER_VERSION,
} from './import/buildBuildingModelCandidate.js';
import { classifyImportApplyHistoryVersion } from './import/historyClassifier.js';
import { logObservabilityEvent } from '../utils/observability.js';

export const IMPORT_SCHEMA_VERSION = 1;

interface ImportPipelineDeps {
  resolveAdapter?: () => ArchitecturalExtractorAdapter;
  resolveRunner?: () => ImportJobRunner;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: ArchitecturalImportSnapshot): ArchitecturalImportSnapshot {
  return structuredClone(snapshot);
}

function mergeDecisions(
  prev: ImportUserDecisionSet,
  patch: Partial<ImportUserDecisionSet>
): ImportUserDecisionSet {
  return {
    ...prev,
    ...patch,
    floorHeightsMmByFloorId: {
      ...(prev.floorHeightsMmByFloorId ?? {}),
      ...(patch.floorHeightsMmByFloorId ?? {}),
    },
    internalBearingWalls: patch.internalBearingWalls ?? prev.internalBearingWalls,
    scale: patch.scale ?? prev.scale,
    issueResolutions: patch.issueResolutions ?? prev.issueResolutions,
  };
}

function computeReviewReadiness(
  snapshot: ArchitecturalImportSnapshot,
  decisions: ImportUserDecisionSet
): {
  missingRequiredDecisions: ImportRequiredDecision[];
  remainingBlockingIssueIds: string[];
  isReadyToApply: boolean;
} {
  const missing: ImportRequiredDecision[] = [];
  const floorIds = snapshot.floors.map((f) => f.id);
  const heightsMap = decisions.floorHeightsMmByFloorId ?? {};
  const heightsComplete = floorIds.every((id) => typeof heightsMap[id] === 'number');
  if (!heightsComplete) {
    missing.push({
      code: 'FLOOR_HEIGHTS_REQUIRED',
      message: 'Нужно заполнить heights для всех этажей',
      satisfied: false,
    });
  }

  if (snapshot.roofHints && !decisions.roofTypeConfirmed) {
    missing.push({
      code: 'ROOF_TYPE_CONFIRMATION_REQUIRED',
      message: 'Нужно подтвердить тип крыши',
      satisfied: false,
    });
  }

  if (decisions.internalBearingWalls?.confirmed === undefined) {
    missing.push({
      code: 'INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED',
      message: 'Нужно подтвердить внутренние несущие стены',
      satisfied: false,
    });
  } else if (decisions.internalBearingWalls.confirmed === true) {
    const candidates = getInternalWallCandidatesFromSnapshot(snapshot);
    const allowed = new Set(candidates.map((w) => w.id));
    const selected = (decisions.internalBearingWalls.wallIds ?? []).filter((id) => allowed.has(id));
    if (candidates.length === 0) {
      missing.push({
        code: 'INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE',
        message: 'В snapshot нет стен для выбора внутренних несущих',
        satisfied: false,
      });
    } else if (selected.length === 0) {
      missing.push({
        code: 'INTERNAL_BEARING_WALL_IDS_REQUIRED',
        message: 'Выберите хотя бы одну стену',
        satisfied: false,
      });
    }
  }

  if (!decisions.scale?.mode) {
    missing.push({
      code: 'SCALE_DECISION_REQUIRED',
      message: 'Нужно подтвердить или переопределить масштаб',
      satisfied: false,
    });
  }
  if (
    decisions.scale?.mode === 'override' &&
    !(typeof decisions.scale.mmPerPixel === 'number' && decisions.scale.mmPerPixel > 0)
  ) {
    missing.push({
      code: 'SCALE_OVERRIDE_VALUE_REQUIRED',
      message: 'Для scale override нужно указать mmPerPixel',
      satisfied: false,
    });
  }

  const blockingIssueIds = snapshot.unresolved
    .filter((u) => u.severity === 'blocking')
    .map((u) => u.id);
  const resolvedIssueIds = new Set(
    (decisions.issueResolutions ?? []).map((x) => x.issueId)
  );
  const remainingBlocking = blockingIssueIds.filter((id) => !resolvedIssueIds.has(id));
  if (remainingBlocking.length > 0) {
    missing.push({
      code: 'BLOCKING_ISSUES_RESOLUTION_REQUIRED',
      message: 'Нужно явно разрешить все blocking issues',
      satisfied: false,
    });
  }

  return {
    missingRequiredDecisions: missing,
    remainingBlockingIssueIds: remainingBlocking,
    isReadyToApply: missing.length === 0,
  };
}

function buildReviewState(
  snapshot: ArchitecturalImportSnapshot,
  decisions: ImportUserDecisionSet,
  actorId: string,
  prev?: ImportReviewState
): ImportReviewState {
  const readiness = computeReviewReadiness(snapshot, decisions);
  const status: ImportReviewState['status'] = prev?.status === 'applied'
    ? 'applied'
    : readiness.isReadyToApply
      ? 'complete'
      : 'draft';
  return {
    status,
    applyStatus: prev?.status === 'applied'
      ? 'applied'
      : readiness.isReadyToApply
        ? 'ready'
        : 'not_ready',
    decisions,
    missingRequiredDecisions: readiness.missingRequiredDecisions,
    remainingBlockingIssueIds: readiness.remainingBlockingIssueIds,
    isReadyToApply: readiness.isReadyToApply,
    reviewedSnapshot: prev?.reviewedSnapshot ?? null,
    reviewedAt: prev?.reviewedAt ?? null,
    reviewedBy: prev?.reviewedBy ?? null,
    appliedAt: prev?.appliedAt ?? null,
    appliedBy: prev?.appliedBy ?? null,
    lastUpdatedAt: nowIso(),
    lastUpdatedBy: actorId,
  };
}

function createInitialEditorApplyState(): ImportEditorApplyState {
  return {
    status: 'draft',
    candidate: undefined,
    errorMessage: null,
    generatedAt: null,
    generatedBy: null,
    mapperVersion: null,
  };
}

function createInitialProjectApplyState(): ImportProjectApplyState {
  return {
    status: 'draft',
    appliedVersionId: null,
    appliedVersionNumber: null,
    appliedAt: null,
    appliedBy: null,
    errorMessage: null,
    note: null,
    summary: null,
  };
}

function buildCandidateApplySummary(candidate: BuildingModelCandidate): CandidateApplySummary {
  return {
    createdOrUpdatedVersionId: candidate.model.meta.versionId ?? '',
    appliedObjectCounts: {
      floors: candidate.model.floors.length,
      walls: candidate.model.walls.length,
      openings: candidate.model.openings.length,
      slabs: candidate.model.slabs.length,
      roofs: candidate.model.roofs.length,
    },
    warningsCount: candidate.warnings.length,
    traceCount: candidate.trace.length,
    basedOnImportJobId: candidate.basedOnImportJobId,
    basedOnMapperVersion: candidate.mapperVersion,
    basedOnReviewedSnapshotVersion: candidate.basedOnReviewedSnapshotVersion,
  };
}

function buildVersionImportProvenance(
  candidate: BuildingModelCandidate,
  actorId: string,
  note?: string
): VersionImportProvenance {
  return {
    sourceKind: 'ai_import',
    importJobId: candidate.basedOnImportJobId,
    mapperVersion: candidate.mapperVersion,
    reviewedSnapshotVersion: candidate.basedOnReviewedSnapshotVersion,
    appliedBy: actorId,
    appliedAt: nowIso(),
    warningsCount: candidate.warnings.length,
    traceCount: candidate.trace.length,
    note: note ?? null,
  };
}

function applyReviewDecisions(
  snapshot: ArchitecturalImportSnapshot,
  decisions: ImportUserDecisionSet
): ReviewedArchitecturalSnapshot {
  const transformed = cloneSnapshot(snapshot);
  const heightsMap = decisions.floorHeightsMmByFloorId ?? {};
  transformed.floors = transformed.floors.map((floor) => ({
    ...floor,
    elevationHintMm:
      typeof heightsMap[floor.id] === 'number' ? heightsMap[floor.id] : floor.elevationHintMm ?? null,
  }));
  if (decisions.roofTypeConfirmed) {
    transformed.roofHints = {
      ...(transformed.roofHints ?? {}),
      likelyType: decisions.roofTypeConfirmed,
    };
  }
  const resolvedIssueIds = (decisions.issueResolutions ?? []).map((x) => x.issueId);
  const resolvedSet = new Set(resolvedIssueIds);
  transformed.unresolved = transformed.unresolved.filter((u) => !resolvedSet.has(u.id));
  transformed.notes = [
    ...transformed.notes,
    'reviewed snapshot generated from explicit user decisions',
  ];
  const reviewed: ReviewedArchitecturalSnapshot = {
    baseSnapshot: cloneSnapshot(snapshot),
    transformedSnapshot: transformed,
    appliedDecisions: decisions,
    resolvedIssueIds,
    notes: ['review/apply completed on backend'],
    generatedAt: nowIso(),
  };
  const parsed = zReviewedArchitecturalSnapshot.safeParse(reviewed);
  if (!parsed.success) {
    throw new ValidationAppError(
      'Не удалось построить reviewed snapshot',
      formatZodError(parsed.error)
    );
  }
  return parsed.data;
}

function assertStatusTransitionAllowed(
  current: ImportJobStatus,
  next: ImportJobStatus
): void {
  if (current === next) return;
  if (current === 'queued' && (next === 'running' || next === 'failed')) return;
  if (current === 'running' && (next === 'needs_review' || next === 'failed')) return;
  throw new ValidationAppError(`Некорректный переход статуса import-job: ${current} -> ${next}`);
}

export async function createImportJobRecord(
  projectId: string,
  createdBy: string,
  input: CreateImportJobRequest
): Promise<ImportJob> {
  const db = getDb();
  const now = FieldValue.serverTimestamp();
  const ref = db.collection(COLLECTIONS.IMPORT_JOBS).doc();
  await ref.set({
    projectId,
    status: 'queued',
    createdBy,
    createdAt: now,
    updatedAt: now,
    importSchemaVersion: IMPORT_SCHEMA_VERSION,
    sourceImages: input.sourceImages,
    snapshot: null,
    errorMessage: null,
  });
  const created = await ref.get();
  return mapImportJobDoc(ref.id, created.data() ?? {});
}

export async function getImportJobById(jobId: string): Promise<ImportJob> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).get();
  if (!snap.exists) {
    throw new NotFoundError(`Import job не найден: ${jobId}`);
  }
  return mapImportJobDoc(snap.id, snap.data() ?? {});
}

export async function updateImportJobStatus(
  jobId: string,
  nextStatus: Extract<ImportJobStatus, 'queued' | 'running'>
): Promise<ImportJob> {
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, nextStatus);
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: nextStatus,
    // queued/running states should not carry a completed snapshot.
    snapshot: null,
    errorMessage: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function completeImportJobWithSnapshot(
  jobId: string,
  snapshot: ArchitecturalImportSnapshot
): Promise<ImportJob> {
  const snapshotValid = zArchitecturalImportSnapshot.safeParse(snapshot);
  if (!snapshotValid.success) {
    throw new ValidationAppError(
      'Некорректный snapshot от extractor adapter',
      formatZodError(snapshotValid.error)
    );
  }
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, 'needs_review');
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: 'needs_review',
    snapshot: snapshotValid.data,
    review: buildReviewState(snapshotValid.data, {}, current.createdBy, current.review),
    editorApply: createInitialEditorApplyState(),
    projectApply: createInitialProjectApplyState(),
    errorMessage: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function failImportJob(jobId: string, errorMessage: string): Promise<ImportJob> {
  const current = await getImportJobById(jobId);
  assertStatusTransitionAllowed(current.status, 'failed');
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    status: 'failed',
    snapshot: null,
    errorMessage: errorMessage.trim() || 'Import pipeline failed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getImportJobById(jobId);
}

export async function runImportJobPipeline(
  job: ImportJob,
  input: CreateImportJobRequest,
  deps?: ImportPipelineDeps
): Promise<ImportJob> {
  await updateImportJobStatus(job.id, 'running');
  try {
    const adapter = deps?.resolveAdapter?.() ?? resolveExtractorAdapter();
    const snapshot = await adapter.extractArchitecturalSnapshot({
      projectId: job.projectId,
      jobId: job.id,
      sourceImages: input.sourceImages,
      projectName: input.projectName,
    });
    return await completeImportJobWithSnapshot(job.id, snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import pipeline failed';
    return await failImportJob(job.id, message);
  }
}

export async function createImportJob(
  projectId: string,
  body: unknown,
  actorId: string,
  deps?: ImportPipelineDeps
): Promise<CreateImportJobResponse> {
  const parsed = zCreateImportJobBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  await getProject(projectId, actorId);
  const queuedJob = await createImportJobRecord(projectId, actorId, parsed.data);
  const runner = deps?.resolveRunner?.() ?? resolveImportJobRunner();
  const job = await runner.execute({
    queuedJob,
    request: parsed.data,
    runPipeline: (jobForRun, reqForRun) =>
      runImportJobPipeline(jobForRun, reqForRun, {
        resolveAdapter: deps?.resolveAdapter,
      }),
  });
  return { job };
}

export async function getImportJob(
  projectId: string,
  jobId: string,
  actorId: string
): Promise<{ job: ImportJob }> {
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  return { job };
}

export async function saveImportJobReview(
  projectId: string,
  jobId: string,
  body: unknown,
  actorId: string
): Promise<SaveImportReviewResponse> {
  const parsed = zSaveImportReviewBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело review запроса', formatZodError(parsed.error));
  }
  if (parsed.data.updatedBy !== actorId) {
    throw new ValidationAppError('updatedBy должен совпадать с x-sip-user-id');
  }
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  if (job.status !== 'needs_review' || !job.snapshot) {
    throw new ValidationAppError('Review можно сохранить только для job в needs_review со snapshot');
  }
  if (job.review?.status === 'applied') {
    throw new ValidationAppError('Review уже applied и не может быть изменен');
  }
  const nextDecisions = mergeDecisions(job.review?.decisions ?? {}, parsed.data.decisions);
  const nextReview = buildReviewState(job.snapshot, nextDecisions, actorId, job.review);
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    review: nextReview,
    editorApply: createInitialEditorApplyState(),
    projectApply: createInitialProjectApplyState(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { job: await getImportJobById(jobId) };
}

export async function applyImportJobReview(
  projectId: string,
  jobId: string,
  body: unknown,
  actorId: string
): Promise<ApplyImportReviewResponse> {
  const parsed = zApplyImportReviewBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело apply-review запроса', formatZodError(parsed.error));
  }
  if (parsed.data.appliedBy !== actorId) {
    throw new ValidationAppError('appliedBy должен совпадать с x-sip-user-id');
  }
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  if (job.status !== 'needs_review' || !job.snapshot) {
    throw new ValidationAppError('apply-review доступен только для needs_review job');
  }
  const review = job.review ?? buildReviewState(job.snapshot, {}, actorId);
  if (review.status === 'applied' && review.reviewedSnapshot) {
    return { job, reviewedSnapshot: review.reviewedSnapshot };
  }
  if (!review.isReadyToApply) {
    throw new AppHttpError(
      409,
      'CONFLICT',
      'Review неполный: заполните обязательные decisions',
      {
        missingRequiredDecisions: review.missingRequiredDecisions,
        remainingBlockingIssueIds: review.remainingBlockingIssueIds,
      }
    );
  }
  const reviewedSnapshot = applyReviewDecisions(job.snapshot, review.decisions);
  const appliedReview: ImportReviewState = {
    ...review,
    status: 'applied',
    applyStatus: 'applied',
    reviewedSnapshot,
    reviewedAt: nowIso(),
    reviewedBy: actorId,
    appliedAt: nowIso(),
    appliedBy: actorId,
    lastUpdatedAt: nowIso(),
    lastUpdatedBy: actorId,
  };
  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(jobId).update({
    review: appliedReview,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const nextJob = await getImportJobById(jobId);
  return { job: nextJob, reviewedSnapshot };
}

export async function listImportJobs(
  projectId: string,
  actorId: string
): Promise<ListImportJobsResponse> {
  await getProject(projectId, actorId);
  const db = getDb();
  const qs = await db
    .collection(COLLECTIONS.IMPORT_JOBS)
    .where('projectId', '==', projectId)
    .limit(100)
    .get();
  const items = qs.docs.map((d) => mapImportJobDoc(d.id, d.data() ?? {}));
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { items };
}

export async function prepareImportJobEditorApply(
  projectId: string,
  jobId: string,
  body: unknown,
  actorId: string
): Promise<PrepareEditorApplyResponse> {
  const parsed = zPrepareEditorApplyBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError(
      'Невалидное тело prepare-editor-apply запроса',
      formatZodError(parsed.error)
    );
  }
  if (parsed.data.generatedBy !== actorId) {
    throw new ValidationAppError('generatedBy должен совпадать с x-sip-user-id');
  }
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  if (job.status !== 'needs_review') {
    throw new AppHttpError(409, 'CONFLICT', 'Import job не готов к editor-apply stage');
  }
  if (!job.review || job.review.status !== 'applied' || !job.review.reviewedSnapshot) {
    throw new AppHttpError(
      409,
      'CONFLICT',
      'Review должен быть applied и содержать reviewedSnapshot'
    );
  }

  let candidate: BuildingModelCandidate;
  try {
    candidate = buildBuildingModelCandidateFromReviewedSnapshot(job.review.reviewedSnapshot, {
      importJobId: job.id,
    });
  } catch (error) {
    const db = getDb();
    await db.collection(COLLECTIONS.IMPORT_JOBS).doc(job.id).update({
      editorApply: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Candidate generation failed',
        generatedAt: nowIso(),
        generatedBy: actorId,
        mapperVersion: IMPORT_CANDIDATE_MAPPER_VERSION,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw new AppHttpError(409, 'CONFLICT', 'Не удалось построить editor candidate');
  }

  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(job.id).update({
    editorApply: {
      status: 'candidate_ready',
      candidate,
      errorMessage: null,
      generatedAt: nowIso(),
      generatedBy: actorId,
      mapperVersion: candidate.mapperVersion,
    },
    projectApply: createInitialProjectApplyState(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const updated = await getImportJobById(job.id);
  return { job: updated, candidate };
}

export async function applyImportJobCandidateToProject(
  projectId: string,
  jobId: string,
  body: unknown,
  actorId: string
): Promise<ApplyCandidateToProjectResponse> {
  const parsed = zApplyCandidateToProjectBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError(
      'Невалидное тело apply-candidate запроса',
      formatZodError(parsed.error)
    );
  }
  if (parsed.data.appliedBy !== actorId) {
    throw new ValidationAppError('appliedBy должен совпадать с x-sip-user-id');
  }
  await getProject(projectId, actorId);
  const job = await getImportJobById(jobId);
  if (job.projectId !== projectId) {
    throw new NotFoundError(`Import job не найден в проекте: ${jobId}`);
  }
  if (job.status !== 'needs_review') {
    throw new AppHttpError(409, 'IMPORT_CANDIDATE_NOT_READY', 'Import job не готов к apply-candidate');
  }
  if (!job.review || job.review.status !== 'applied' || !job.review.reviewedSnapshot) {
    throw new AppHttpError(409, 'IMPORT_REVIEW_NOT_APPLIED', 'Review должен быть applied перед apply-candidate');
  }
  if (!job.editorApply || job.editorApply.status !== 'candidate_ready') {
    throw new AppHttpError(409, 'IMPORT_CANDIDATE_NOT_READY', 'Editor apply candidate еще не подготовлен');
  }
  if (!job.editorApply.candidate) {
    throw new AppHttpError(409, 'IMPORT_CANDIDATE_MISSING', 'Editor apply candidate отсутствует');
  }
  const currentVersion = await getCurrentVersion(projectId, actorId);
  if (!currentVersion) {
    throw new NotFoundError('Текущая версия не назначена');
  }
  if (
    currentVersion.id !== parsed.data.expectedCurrentVersionId ||
    currentVersion.versionNumber !== parsed.data.expectedVersionNumber ||
    currentVersion.schemaVersion !== parsed.data.expectedSchemaVersion
  ) {
    logObservabilityEvent('import_apply_candidate_conflict', {
      projectId,
      jobId,
      code: 'IMPORT_APPLY_CONCURRENCY_CONFLICT',
      currentVersionId: currentVersion.id,
      currentVersionNumber: currentVersion.versionNumber,
    }, 'warn');
    throw new AppHttpError(
      409,
      'IMPORT_APPLY_CONCURRENCY_CONFLICT',
      'Текущая версия проекта изменилась, apply-candidate отклонен',
      {
        currentVersionId: currentVersion.id,
        currentVersionNumber: currentVersion.versionNumber,
        currentSchemaVersion: currentVersion.schemaVersion,
      }
    );
  }
  if (job.projectApply?.status === 'applied' && job.projectApply.summary) {
    return {
      job,
      appliedVersionMeta: {
        id: currentVersion.id,
        projectId: currentVersion.projectId,
        versionNumber: currentVersion.versionNumber,
        schemaVersion: currentVersion.schemaVersion,
        createdAt: currentVersion.createdAt,
      },
      applySummary: job.projectApply.summary,
    };
  }

  const db = getDb();
  await db.collection(COLLECTIONS.IMPORT_JOBS).doc(job.id).update({
    projectApply: {
      ...(job.projectApply ?? createInitialProjectApplyState()),
      status: 'draft',
      errorMessage: null,
      note: parsed.data.note ?? null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const appliedVersion = await patchCurrentVersion(
      projectId,
      {
        buildingModel: job.editorApply.candidate.model,
        updatedBy: actorId,
        expectedCurrentVersionId: parsed.data.expectedCurrentVersionId,
        expectedVersionNumber: parsed.data.expectedVersionNumber,
        expectedSchemaVersion: parsed.data.expectedSchemaVersion,
      },
      actorId
    );
    const versionProvenance = buildVersionImportProvenance(
      job.editorApply.candidate,
      actorId,
      parsed.data.note
    );
    const provenanceParsed = zVersionImportProvenance.safeParse(versionProvenance);
    if (!provenanceParsed.success) {
      throw new ValidationAppError(
        'Не удалось сформировать import provenance metadata',
        formatZodError(provenanceParsed.error)
      );
    }
    await db.collection(COLLECTIONS.PROJECT_VERSIONS).doc(appliedVersion.id).set(
      {
        importProvenance: provenanceParsed.data,
      },
      { merge: true }
    );
    const summary = buildCandidateApplySummary(job.editorApply.candidate);
    summary.createdOrUpdatedVersionId = appliedVersion.id;
    await db.collection(COLLECTIONS.IMPORT_JOBS).doc(job.id).update({
      projectApply: {
        status: 'applied',
        summary,
        appliedAt: nowIso(),
        appliedBy: actorId,
        appliedVersionId: appliedVersion.id,
        appliedVersionNumber: appliedVersion.versionNumber,
        errorMessage: null,
        note: parsed.data.note ?? null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updatedJob = await getImportJobById(job.id);
    logObservabilityEvent('import_apply_candidate_success', {
      projectId,
      jobId: job.id,
      versionId: appliedVersion.id,
      versionNumber: appliedVersion.versionNumber,
    });
    return {
      job: updatedJob,
      appliedVersionMeta: {
        id: appliedVersion.id,
        projectId: appliedVersion.projectId,
        versionNumber: appliedVersion.versionNumber,
        schemaVersion: appliedVersion.schemaVersion,
        createdAt: appliedVersion.createdAt,
      },
      applySummary: summary,
    };
  } catch (error) {
    if (error instanceof VersionConflictError) {
      logObservabilityEvent('import_apply_candidate_conflict', {
        projectId,
        jobId,
        code: 'IMPORT_APPLY_CONCURRENCY_CONFLICT',
        ...(error.details ?? {}),
      }, 'warn');
      throw new AppHttpError(
        409,
        'IMPORT_APPLY_CONCURRENCY_CONFLICT',
        'Текущая версия проекта изменилась, apply-candidate отклонен',
        error.details
      );
    }
    await db.collection(COLLECTIONS.IMPORT_JOBS).doc(job.id).update({
      projectApply: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Import apply failed',
        appliedAt: null,
        appliedBy: null,
        appliedVersionId: null,
        appliedVersionNumber: null,
        summary: null,
        note: parsed.data.note ?? null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw new AppHttpError(500, 'IMPORT_APPLY_FAILED', 'Не удалось применить candidate в текущую версию');
  }
}

export async function listImportApplyHistory(
  projectId: string,
  actorId: string
): Promise<GetImportApplyHistoryResponse> {
  await getProject(projectId, actorId);
  const db = getDb();
  const qs = await db
    .collection(COLLECTIONS.PROJECT_VERSIONS)
    .where('projectId', '==', projectId)
    .limit(200)
    .get();
  const items: ImportApplyHistoryItem[] = [];
  for (const doc of qs.docs) {
    const raw = doc.data() ?? {};
    const classified = classifyImportApplyHistoryVersion({
      versionId: doc.id,
      versionNumberRaw: raw.versionNumber,
      importProvenanceRaw: raw.importProvenance,
      nowIso,
    });
    if (classified.item) {
      items.push(classified.item);
    }
    if (classified.isLegacyDetected) {
      logObservabilityEvent('import_history_legacy_item_detected', {
        projectId,
        versionId: doc.id,
        importJobId: classified.item?.importJobId ?? 'unknown',
        missingFieldsCount: classified.item?.missingFields?.length ?? 0,
      }, 'warn');
    }
  }
  items.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  return { items };
}
