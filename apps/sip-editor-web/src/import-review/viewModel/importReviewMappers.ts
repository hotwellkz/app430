import type { ImportJob, ImportUnresolvedIssue, ImportUserDecisionSet } from '@2wix/shared-types';
import {
  IMPORT_EDITOR_APPLY_STATUS_LABELS,
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_PROJECT_APPLY_STATUS_LABELS,
  IMPORT_REVIEW_STATUS_LABELS,
  IMPORT_REVIEW_UI,
  ISSUE_RESOLUTION_OPTIONS,
  ISSUE_SEVERITY_LABELS,
  REQUIRED_DECISION_HINTS,
  REQUIRED_DECISION_LABELS,
  ROOF_TYPE_OPTIONS,
  SCALE_MODE_OPTIONS,
} from '../constants/labels';
import {
  floorLabelForSnapshot,
  getInternalWallCandidatesFromSnapshot,
  wallSubtitleCompact,
  wallTypeLabel,
} from '../utils/internalWallCandidates';
import { computeImportReviewReadiness } from './reviewReadiness';
import type {
  ImportReviewJobListItemViewModel,
  ImportReviewJobViewModel,
  IssueViewModel,
  RequiredDecisionFieldViewModel,
} from './importReviewViewModel.types';

export function shortJobId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

export function formatJobCreatedAtLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function mapUnresolvedToIssueViewModel(u: ImportUnresolvedIssue): IssueViewModel {
  const related = u.relatedIds?.length ? u.relatedIds.join(', ') : '—';
  return {
    id: u.id,
    code: u.code,
    severity: u.severity,
    severityLabel: ISSUE_SEVERITY_LABELS[u.severity] ?? u.severity,
    title: u.code,
    subtitle: u.requiredAction ? `${u.message} · ${u.requiredAction}` : u.message,
    relatedIdsLabel: related,
  };
}

function labelForReview(job: ImportJob): string {
  const st = job.review?.status;
  if (!st) return '—';
  return IMPORT_REVIEW_STATUS_LABELS[st] ?? st;
}

function labelForEditorApply(job: ImportJob): string {
  const st = job.editorApply?.status ?? 'draft';
  return IMPORT_EDITOR_APPLY_STATUS_LABELS[st] ?? st;
}

function labelForProjectApply(job: ImportJob): string {
  const st = job.projectApply?.status ?? 'draft';
  return IMPORT_PROJECT_APPLY_STATUS_LABELS[st] ?? st;
}

export function mapImportJobToListItemViewModel(job: ImportJob): ImportReviewJobListItemViewModel {
  const reviewSt = job.review?.status ?? 'none';
  return {
    id: job.id,
    createdAtLabel: formatJobCreatedAtLabel(job.createdAt),
    jobIdShort: shortJobId(job.id),
    extractionStatus: job.status,
    extractionStatusLabel: IMPORT_JOB_STATUS_LABELS[job.status] ?? job.status,
    reviewStatus: reviewSt,
    reviewStatusLabel:
      reviewSt === 'none' ? 'Нет данных' : IMPORT_REVIEW_STATUS_LABELS[reviewSt] ?? reviewSt,
  };
}

function buildRequiredFields(
  job: ImportJob,
  decisions: ImportUserDecisionSet,
  reviewApplied: boolean
): RequiredDecisionFieldViewModel[] {
  const snap = job.snapshot;
  if (!snap || reviewApplied) return [];

  const readiness = computeImportReviewReadiness(snap, decisions);
  const missingCodes = new Set(readiness.missingRequiredDecisions.map((m) => m.code));
  const heights = decisions.floorHeightsMmByFloorId ?? {};
  const fields: RequiredDecisionFieldViewModel[] = [];

  for (const floor of snap.floors) {
    const v = heights[floor.id];
    const filled = typeof v === 'number';
    fields.push({
      key: `floorHeight:${floor.id}`,
      label: `Высота этажа (${floor.label ?? floor.id})`,
      description: REQUIRED_DECISION_HINTS.FLOOR_HEIGHTS_REQUIRED,
      controlType: 'floorHeightMm',
      value: filled ? v : '',
      floorId: floor.id,
      isRequired: true,
      isMissing: missingCodes.has('FLOOR_HEIGHTS_REQUIRED') && !filled,
    });
  }

  if (snap.roofHints) {
    fields.push({
      key: 'roofType',
      label: REQUIRED_DECISION_LABELS.ROOF_TYPE_CONFIRMATION_REQUIRED,
      description: REQUIRED_DECISION_HINTS.ROOF_TYPE_CONFIRMATION_REQUIRED,
      controlType: 'select',
      value: decisions.roofTypeConfirmed ?? '',
      options: ROOF_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      isRequired: true,
      isMissing: missingCodes.has('ROOF_TYPE_CONFIRMATION_REQUIRED'),
    });
  }

  const bearingCodes = [
    'INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED',
    'INTERNAL_BEARING_WALL_IDS_REQUIRED',
    'INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE',
  ] as const;
  const bearingMissing = bearingCodes.some((c) => missingCodes.has(c));
  const wallCandidates = getInternalWallCandidatesFromSnapshot(snap);
  const wallRows = wallCandidates.map((w) => ({
    wallId: w.id,
    floorLabel: floorLabelForSnapshot(snap, w.floorId),
    typeLabel: wallTypeLabel(w),
    subtitle: wallSubtitleCompact(w),
  }));
  const mode: '' | 'no' | 'yes' =
    decisions.internalBearingWalls?.confirmed === undefined
      ? ''
      : decisions.internalBearingWalls.confirmed
        ? 'yes'
        : 'no';
  const candidatesEmpty = wallRows.length === 0;
  fields.push({
    key: 'internalBearingWalls',
    label: IMPORT_REVIEW_UI.internalBearingSectionTitle,
    description: REQUIRED_DECISION_HINTS.INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED,
    controlType: 'internalBearingWalls',
    value: {
      mode,
      wallIds: decisions.internalBearingWalls?.wallIds ?? [],
    },
    internalBearingMode: mode,
    internalBearingWallRows: wallRows,
    internalBearingCandidatesEmpty: candidatesEmpty,
    isRequired: true,
    isMissing: bearingMissing,
  });

  fields.push({
    key: 'scaleMode',
    label: REQUIRED_DECISION_LABELS.SCALE_DECISION_REQUIRED,
    description: REQUIRED_DECISION_HINTS.SCALE_DECISION_REQUIRED,
    controlType: 'scaleMode',
    value: decisions.scale?.mode ?? '',
    options: SCALE_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    isRequired: true,
    isMissing:
      missingCodes.has('SCALE_DECISION_REQUIRED') ||
      missingCodes.has('SCALE_OVERRIDE_VALUE_REQUIRED'),
  });

  if (decisions.scale?.mode === 'override') {
    fields.push({
      key: 'scaleMmPerPixel',
      label: REQUIRED_DECISION_LABELS.SCALE_OVERRIDE_VALUE_REQUIRED,
      description: REQUIRED_DECISION_HINTS.SCALE_OVERRIDE_VALUE_REQUIRED,
      controlType: 'number',
      value:
        typeof decisions.scale.mmPerPixel === 'number' && decisions.scale.mmPerPixel > 0
          ? decisions.scale.mmPerPixel
          : '',
      isRequired: true,
      isMissing: missingCodes.has('SCALE_OVERRIDE_VALUE_REQUIRED'),
    });
  }

  const blocking = snap.unresolved.filter((u) => u.severity === 'blocking');
  const resolutions = decisions.issueResolutions ?? [];
  const resById = new Map(resolutions.map((r) => [r.issueId, r]));
  for (const issue of blocking) {
    const r = resById.get(issue.id);
    fields.push({
      key: `issueResolution:${issue.id}`,
      label: `Blocking: ${issue.code}`,
      description: issue.message,
      controlType: 'issueResolution',
      issueId: issue.id,
      value: r?.action ?? '',
      options: ISSUE_RESOLUTION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      isRequired: true,
      isMissing: missingCodes.has('BLOCKING_ISSUES_RESOLUTION_REQUIRED') && !r,
    });
  }

  return fields;
}

export function mapImportJobToDetailViewModel(
  job: ImportJob,
  draftDecisions: ImportUserDecisionSet
): ImportReviewJobViewModel {
  const snap = job.snapshot;
  const reviewApplied = job.review?.status === 'applied';
  const readiness = snap ? computeImportReviewReadiness(snap, draftDecisions) : null;

  const canSaveReview =
    job.status === 'needs_review' &&
    snap !== null &&
    job.review?.status !== 'applied';

  const canApplyReview =
    job.status === 'needs_review' &&
    job.review?.status !== 'applied' &&
    Boolean(readiness?.isReadyToApply);

  const canPrepareCandidate = job.status === 'needs_review' && job.review?.status === 'applied';

  const canApplyCandidate = job.editorApply?.status === 'candidate_ready';

  const issues = snap?.unresolved.map(mapUnresolvedToIssueViewModel) ?? [];

  const reviewStatus = job.review?.status ?? 'none';

  const headerStatusLine = [
    IMPORT_JOB_STATUS_LABELS[job.status] ?? job.status,
    reviewStatus !== 'none' ? labelForReview(job) : null,
    job.editorApply?.status ? labelForEditorApply(job) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: job.id,
    createdAtLabel: formatJobCreatedAtLabel(job.createdAt),
    jobIdShort: shortJobId(job.id),
    extractionStatus: job.status,
    extractionStatusLabel: IMPORT_JOB_STATUS_LABELS[job.status] ?? job.status,
    reviewStatus,
    reviewStatusLabel:
      reviewStatus === 'none' ? 'Нет review' : IMPORT_REVIEW_STATUS_LABELS[reviewStatus] ?? reviewStatus,
    candidateStatus: job.editorApply?.status ?? 'draft',
    candidateStatusLabel: labelForEditorApply(job),
    projectApplyStatus: job.projectApply?.status ?? 'draft',
    projectApplyStatusLabel: labelForProjectApply(job),
    sourceImagesCount: job.sourceImages?.length ?? 0,
    unresolvedCount: snap?.unresolved.length ?? 0,
    missingRequiredDecisionsCount: readiness?.missingRequiredDecisions.length ?? 0,
    remainingBlockingIssuesCount: readiness?.remainingBlockingIssueIds.length ?? 0,
    isReadyToApply: readiness?.isReadyToApply ?? false,
    canSaveReview,
    canApplyReview,
    canPrepareCandidate,
    canApplyCandidate,
    requiredFields: buildRequiredFields(job, draftDecisions, reviewApplied),
    issues,
    errorMessage: job.errorMessage ?? null,
    headerStatusLine,
  };
}
