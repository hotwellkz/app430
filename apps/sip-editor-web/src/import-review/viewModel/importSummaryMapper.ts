import type {
  ArchitecturalImportSnapshot,
  BuildingModelCandidate,
  ImportJob,
  ImportUserDecisionSet,
} from '@2wix/shared-types';
import {
  IMPORT_APPLY_STATUS_LABELS,
  IMPORT_EDITOR_APPLY_STATUS_LABELS,
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_PROJECT_APPLY_STATUS_LABELS,
  IMPORT_REVIEW_STATUS_LABELS,
  IMPORT_SUMMARY_UI,
  ROOF_TYPE_OPTIONS,
  SCALE_MODE_OPTIONS,
} from '../constants/labels';
import { formatJobCreatedAtLabel, shortJobId } from './importReviewMappers';
import type {
  ImportSummaryBadgeTone,
  ImportSummaryBadgeViewModel,
  ImportSummaryKeyValueLine,
  ImportSummaryViewModel,
} from './importSummaryViewModel.types';

/** Показать первые `max` id и сколько ещё осталось. */
export function compactWallIdsSummary(ids: string[], maxFirst = 3): { chips: string[]; more: number } {
  const uniq = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
  return { chips: uniq.slice(0, maxFirst), more: Math.max(0, uniq.length - maxFirst) };
}

function toneForJobStatus(status: ImportJob['status']): ImportSummaryBadgeTone {
  if (status === 'failed') return 'bad';
  if (status === 'running' || status === 'queued') return 'warn';
  if (status === 'needs_review') return 'ok';
  return 'neutral';
}

function toneForReviewStatus(st: string | undefined): ImportSummaryBadgeTone {
  if (st === 'applied') return 'ok';
  if (st === 'complete') return 'ok';
  if (st === 'draft') return 'warn';
  return 'neutral';
}

function toneForEditorApply(st: string | undefined): ImportSummaryBadgeTone {
  if (st === 'failed') return 'bad';
  if (st === 'candidate_ready') return 'ok';
  return 'neutral';
}

function toneForProjectApply(st: string | undefined): ImportSummaryBadgeTone {
  if (st === 'failed') return 'bad';
  if (st === 'applied') return 'ok';
  return 'neutral';
}

function roofLabel(v: NonNullable<ImportUserDecisionSet['roofTypeConfirmed']>): string {
  return ROOF_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function scaleLabel(decisions: ImportUserDecisionSet): string | null {
  const mode = decisions.scale?.mode;
  if (!mode) return null;
  const modeStr = SCALE_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
  if (mode === 'override') {
    const mm = decisions.scale?.mmPerPixel;
    if (typeof mm === 'number' && mm > 0) {
      return `${modeStr}: ${mm} мм/px`;
    }
    return `${modeStr} (значение не задано)`;
  }
  return modeStr;
}

function formatFloorHeightsLine(decisions: ImportUserDecisionSet, snap: ArchitecturalImportSnapshot | null): string | null {
  const m = decisions.floorHeightsMmByFloorId;
  if (!m || Object.keys(m).length === 0) return null;
  const parts: string[] = [];
  const floors = snap?.floors ?? [];
  const seen = new Set<string>();
  for (const f of floors) {
    const v = m[f.id];
    if (typeof v === 'number') {
      parts.push(`${f.label ?? f.id}: ${v} мм`);
      seen.add(f.id);
    }
  }
  for (const [id, v] of Object.entries(m)) {
    if (seen.has(id)) continue;
    if (typeof v === 'number') parts.push(`${id}: ${v} мм`);
  }
  return parts.length ? `${IMPORT_SUMMARY_UI.floorHeightsPrefix}${parts.join('; ')}` : null;
}

function formatInternalBearingLine(decisions: ImportUserDecisionSet): string | null {
  const ib = decisions.internalBearingWalls;
  if (!ib || ib.confirmed === undefined) return null;
  if (!ib.confirmed) {
    return `${IMPORT_SUMMARY_UI.internalBearingPrefix}${IMPORT_SUMMARY_UI.internalBearingNo}`;
  }
  const ids = ib.wallIds ?? [];
  const { chips, more } = compactWallIdsSummary(ids, 3);
  const chipStr = chips.map((c) => (c.length > 14 ? `${c.slice(0, 12)}…` : c)).join(', ');
  const n = ids.length;
  const tail = more > 0 ? ` ${IMPORT_SUMMARY_UI.moreWalls(more)}` : '';
  return `${IMPORT_SUMMARY_UI.internalBearingPrefix}${IMPORT_SUMMARY_UI.internalBearingYesCount(n)}${
    chipStr ? ` (${chipStr}${tail})` : ''
  }`;
}

function buildSavedDecisionLines(job: ImportJob): { lines: string[]; hint: string | null } {
  const review = job.review;
  const decisions = review?.decisions;
  if (!review) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintNoReview };
  }
  if (!decisions) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintNoSavedDecisions };
  }

  const lines: string[] = [];
  const snap = job.snapshot;

  const fh = formatFloorHeightsLine(decisions, snap);
  if (fh) lines.push(fh);

  if (decisions.roofTypeConfirmed) {
    lines.push(`${IMPORT_SUMMARY_UI.roofPrefix}${roofLabel(decisions.roofTypeConfirmed)}`);
  }

  const sc = scaleLabel(decisions);
  if (sc) {
    lines.push(`${IMPORT_SUMMARY_UI.scalePrefix}${sc}`);
  }

  const ib = formatInternalBearingLine(decisions);
  if (ib) lines.push(ib);

  const ir = decisions.issueResolutions?.length ?? 0;
  if (ir > 0) {
    lines.push(`${IMPORT_SUMMARY_UI.issueResolutionsPrefix}${ir}`);
  }

  if (lines.length === 0) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintDecisionsEmpty };
  }
  return { lines, hint: null };
}

function candidateCountsLines(candidate: BuildingModelCandidate): ImportSummaryKeyValueLine[] {
  const m = candidate.model;
  const lines: ImportSummaryKeyValueLine[] = [
    {
      label: IMPORT_SUMMARY_UI.candidateStatusLabel,
      value: candidate.status === 'partial' ? 'Частичный' : candidate.status === 'ready' ? 'Готов' : '—',
    },
    {
      label: IMPORT_SUMMARY_UI.countsLabel,
      value: `этажей ${m.floors.length}, стен ${m.walls.length}, проёмов ${m.openings.length}, плит ${m.slabs.length}, крыш ${m.roofs.length}`,
    },
    {
      label: IMPORT_SUMMARY_UI.warningsTraceLabel,
      value: `предупреждений ${candidate.warnings.length}, trace ${candidate.trace.length}`,
    },
    {
      label: IMPORT_SUMMARY_UI.mapperVersionLabel,
      value: candidate.mapperVersion,
    },
    {
      label: IMPORT_SUMMARY_UI.generatedAtLabel,
      value: formatJobCreatedAtLabel(candidate.generatedAt),
    },
  ];
  return lines;
}

function buildCandidateBlock(job: ImportJob): { lines: ImportSummaryKeyValueLine[]; hint: string | null } {
  const review = job.review;
  if (review?.status !== 'applied') {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintReviewNotAppliedForCandidate };
  }

  const ea = job.editorApply;
  if (!ea) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintCandidateNotPrepared };
  }
  if (ea.status === 'failed') {
    const msg = ea.errorMessage?.trim() || 'Ошибка';
    return {
      lines: [{ label: IMPORT_SUMMARY_UI.errorLabel, value: msg }],
      hint: null,
    };
  }
  if (!ea.candidate) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintCandidateNotPrepared };
  }
  return { lines: candidateCountsLines(ea.candidate), hint: null };
}

function buildProjectApplyBlock(job: ImportJob): { lines: ImportSummaryKeyValueLine[]; hint: string | null } {
  const pa = job.projectApply;
  if (!pa || pa.status === 'draft') {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintNotAppliedToProject };
  }
  if (pa.status === 'failed') {
    const msg = pa.errorMessage?.trim() || 'Ошибка';
    return {
      lines: [{ label: IMPORT_SUMMARY_UI.errorLabel, value: msg }],
      hint: null,
    };
  }
  if (pa.status !== 'applied') {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintNotAppliedToProject };
  }

  const lines: ImportSummaryKeyValueLine[] = [];
  if (typeof pa.appliedVersionNumber === 'number') {
    lines.push({
      label: IMPORT_SUMMARY_UI.appliedVersionNumberLabel,
      value: String(pa.appliedVersionNumber),
    });
  }
  if (pa.appliedVersionId) {
    lines.push({
      label: IMPORT_SUMMARY_UI.appliedVersionIdLabel,
      value: shortJobId(pa.appliedVersionId),
    });
  }
  if (pa.appliedAt) {
    lines.push({
      label: IMPORT_SUMMARY_UI.appliedAtLabel,
      value: formatJobCreatedAtLabel(pa.appliedAt),
    });
  }
  if (pa.appliedBy) {
    lines.push({
      label: IMPORT_SUMMARY_UI.appliedByLabel,
      value: shortJobId(pa.appliedBy),
    });
  }

  const s = pa.summary;
  if (s) {
    lines.push({
      label: IMPORT_SUMMARY_UI.objectCountsLabel,
      value: `этажи ${s.appliedObjectCounts.floors}, стены ${s.appliedObjectCounts.walls}, проёмы ${s.appliedObjectCounts.openings}, плиты ${s.appliedObjectCounts.slabs}, крыши ${s.appliedObjectCounts.roofs}`,
    });
    lines.push({
      label: IMPORT_SUMMARY_UI.warningsTraceShortLabel,
      value: `предупреждений ${s.warningsCount}, trace ${s.traceCount}`,
    });
    lines.push({
      label: IMPORT_SUMMARY_UI.basedOnMapperLabel,
      value: s.basedOnMapperVersion,
    });
  }

  if (pa.note?.trim()) {
    lines.push({ label: IMPORT_SUMMARY_UI.noteLabel, value: pa.note.trim() });
  }

  if (lines.length === 0) {
    return { lines: [], hint: IMPORT_SUMMARY_UI.hintProjectAppliedNoDetails };
  }
  return { lines, hint: null };
}

export function mapImportSummaryViewModel(job: ImportJob): ImportSummaryViewModel {
  const review = job.review;
  const reviewSt = review?.status;
  const reviewText = reviewSt ? IMPORT_REVIEW_STATUS_LABELS[reviewSt] ?? reviewSt : 'Нет данных';
  const applySt = review?.applyStatus;
  const applyText = applySt ? IMPORT_APPLY_STATUS_LABELS[applySt] ?? applySt : '—';

  const pipelineBadges: ImportSummaryBadgeViewModel[] = [
    {
      key: 'extraction',
      label: IMPORT_SUMMARY_UI.badgeExtraction,
      text: IMPORT_JOB_STATUS_LABELS[job.status] ?? job.status,
      tone: toneForJobStatus(job.status),
    },
    {
      key: 'review',
      label: IMPORT_SUMMARY_UI.badgeReview,
      text: `${reviewText} · apply: ${applyText}`,
      tone: toneForReviewStatus(reviewSt),
    },
    {
      key: 'editorApply',
      label: IMPORT_SUMMARY_UI.badgeCandidatePrep,
      text: IMPORT_EDITOR_APPLY_STATUS_LABELS[job.editorApply?.status ?? 'draft'] ?? (job.editorApply?.status ?? 'draft'),
      tone: toneForEditorApply(job.editorApply?.status),
    },
    {
      key: 'projectApply',
      label: IMPORT_SUMMARY_UI.badgeProject,
      text: IMPORT_PROJECT_APPLY_STATUS_LABELS[job.projectApply?.status ?? 'draft'] ?? (job.projectApply?.status ?? 'draft'),
      tone: toneForProjectApply(job.projectApply?.status),
    },
  ];

  const saved = buildSavedDecisionLines(job);
  const cand = buildCandidateBlock(job);
  const proj = buildProjectApplyBlock(job);

  return {
    sectionTitle: IMPORT_SUMMARY_UI.sectionTitle,
    pipelineBadges,
    savedDecisions: {
      title: IMPORT_SUMMARY_UI.savedDecisionsTitle,
      lines: saved.lines,
      hint: saved.hint,
    },
    candidate: {
      title: IMPORT_SUMMARY_UI.candidateTitle,
      lines: cand.lines,
      hint: cand.hint,
    },
    projectApply: {
      title: IMPORT_SUMMARY_UI.projectApplyTitle,
      lines: proj.lines,
      hint: proj.hint,
    },
  };
}
