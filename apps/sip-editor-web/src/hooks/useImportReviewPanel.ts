import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplyCandidateToProjectResponse, ImportUserDecisionSet } from '@2wix/shared-types';
import { SipApiError } from '@/api/http';
import {
  applyImportJobCandidateToProject,
  applyImportJobReview,
  getImportJob,
  listImportJobs,
  prepareImportJobEditorApply,
  saveImportJobReview,
} from '@/api/projectsApi';
import { getSipUserId } from '@/identity/sipUser';
import { IMPORT_REVIEW_UI } from '@/import-review/constants/labels';
import {
  applyFieldToDecisions,
  applyInternalBearingWallsInteraction,
  initialDecisionsFromJob,
  type InternalBearingWallsInteractionPayload,
} from '@/import-review/viewModel/decisionsDraft';
import {
  mapImportJobToDetailViewModel,
  mapImportJobToListItemViewModel,
} from '@/import-review/viewModel/importReviewMappers';
import { mapImportSummaryViewModel } from '@/import-review/viewModel/importSummaryMapper';
import type { ImportSummaryViewModel } from '@/import-review/viewModel/importSummaryViewModel.types';
import type { ImportReviewPanelMessage } from '@/import-review/viewModel/importReviewViewModel.types';
import type { RequiredDecisionFieldViewModel } from '@/import-review/viewModel/importReviewViewModel.types';
import { formatImportReviewError } from '@/import-review/utils/formatImportReviewError';

export interface VersionConcurrencyMarkers {
  expectedCurrentVersionId: string;
  expectedVersionNumber: number;
  expectedSchemaVersion: number;
}

function jobQueryKey(projectId: string, jobId: string) {
  return ['sip-import-job', projectId, jobId] as const;
}

function jobsListKey(projectId: string) {
  return ['sip-import-jobs', projectId] as const;
}

export interface UseImportReviewPanelOptions {
  /** После успешного apply-candidate: refetch current version, история import, синхронизация редактора (EditorShell). */
  onEditorRefreshAfterApply?: () => Promise<void>;
}

export function useImportReviewPanel(
  projectId: string,
  versionMarkers: VersionConcurrencyMarkers | null,
  options: UseImportReviewPanelOptions = {}
) {
  const { onEditorRefreshAfterApply } = options;
  const queryClient = useQueryClient();
  const sipUserId = getSipUserId();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draftDecisions, setDraftDecisions] = useState<ImportUserDecisionSet>({});
  const [decisionsDirty, setDecisionsDirty] = useState(false);
  const [panelMessage, setPanelMessage] = useState<ImportReviewPanelMessage | null>(null);
  const [postApplyRefreshPending, setPostApplyRefreshPending] = useState(false);

  const jobsQuery = useQuery({
    queryKey: jobsListKey(projectId),
    queryFn: () => listImportJobs(projectId),
    enabled: Boolean(projectId && sipUserId),
  });

  const jobDetailQuery = useQuery({
    queryKey: selectedJobId ? jobQueryKey(projectId, selectedJobId) : ['sip-import-job', 'none'],
    queryFn: () => getImportJob(projectId, selectedJobId!),
    enabled: Boolean(projectId && sipUserId && selectedJobId),
  });

  const job = jobDetailQuery.data?.job ?? null;

  useEffect(() => {
    setDecisionsDirty(false);
    setDraftDecisions({});
  }, [selectedJobId]);

  useEffect(() => {
    if (!job || job.id !== selectedJobId) return;
    if (!decisionsDirty) {
      setDraftDecisions(initialDecisionsFromJob(job));
    }
  }, [job, selectedJobId, decisionsDirty]);

  const invalidateJobQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: jobsListKey(projectId) });
    if (selectedJobId) {
      void queryClient.invalidateQueries({ queryKey: jobQueryKey(projectId, selectedJobId) });
    }
  }, [queryClient, projectId, selectedJobId]);

  const saveReviewMutation = useMutation({
    mutationFn: async (decisions: ImportUserDecisionSet) => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      if (!selectedJobId) throw new Error('Job не выбран');
      return saveImportJobReview(projectId, selectedJobId, {
        updatedBy: uid,
        decisions,
      });
    },
    onSuccess: (res) => {
      if (selectedJobId) {
        queryClient.setQueryData(jobQueryKey(projectId, selectedJobId), res);
      }
      setDecisionsDirty(false);
      setDraftDecisions(initialDecisionsFromJob(res.job));
      invalidateJobQueries();
      setPanelMessage({
        kind: 'success',
        title: 'Черновик сохранён',
        detail: 'Review обновлён на сервере.',
      });
    },
    onError: (e: unknown) => {
      const f = formatImportReviewError(e, 'Не удалось сохранить review');
      setPanelMessage({ kind: 'error', title: f.title, detail: f.detail, code: f.code });
    },
  });

  const applyReviewFlowMutation = useMutation({
    mutationFn: async (payload: { dirty: boolean; decisions: ImportUserDecisionSet }) => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      if (!selectedJobId) throw new Error('Job не выбран');
      if (payload.dirty) {
        const saved = await saveImportJobReview(projectId, selectedJobId, {
          updatedBy: uid,
          decisions: payload.decisions,
        });
        queryClient.setQueryData(jobQueryKey(projectId, selectedJobId), saved);
        setDecisionsDirty(false);
        setDraftDecisions(initialDecisionsFromJob(saved.job));
      }
      return applyImportJobReview(projectId, selectedJobId, { appliedBy: uid });
    },
    onSuccess: (res) => {
      if (selectedJobId) {
        queryClient.setQueryData(jobQueryKey(projectId, selectedJobId), { job: res.job });
      }
      setDecisionsDirty(false);
      setDraftDecisions(initialDecisionsFromJob(res.job));
      invalidateJobQueries();
      setPanelMessage({
        kind: 'success',
        title: 'Review применён',
        detail: 'Reviewed snapshot создан на сервере.',
      });
    },
    onError: (e: unknown) => {
      const f = formatImportReviewError(e, 'Не удалось применить review');
      setPanelMessage({ kind: 'error', title: f.title, detail: f.detail, code: f.code });
    },
  });

  const prepareMutation = useMutation({
    mutationFn: async () => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      if (!selectedJobId) throw new Error('Job не выбран');
      return prepareImportJobEditorApply(projectId, selectedJobId, { generatedBy: uid });
    },
    onSuccess: (res) => {
      if (selectedJobId) {
        queryClient.setQueryData(jobQueryKey(projectId, selectedJobId), { job: res.job });
      }
      invalidateJobQueries();
      const c = res.candidate;
      setPanelMessage({
        kind: 'success',
        title: 'Candidate подготовлен',
        detail: `warnings: ${c.warnings.length}, trace: ${c.trace.length}, mapper: ${c.mapperVersion}`,
      });
    },
    onError: (e: unknown) => {
      const f = formatImportReviewError(e, 'Не удалось подготовить candidate');
      setPanelMessage({ kind: 'error', title: f.title, detail: f.detail, code: f.code });
    },
  });

  const applyCandidateMutation = useMutation({
    mutationFn: async (): Promise<ApplyCandidateToProjectResponse> => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      if (!selectedJobId) throw new Error('Job не выбран');
      if (!versionMarkers) {
        throw new Error('Нет маркеров текущей версии проекта');
      }
      return applyImportJobCandidateToProject(projectId, selectedJobId, {
        appliedBy: uid,
        expectedCurrentVersionId: versionMarkers.expectedCurrentVersionId,
        expectedVersionNumber: versionMarkers.expectedVersionNumber,
        expectedSchemaVersion: versionMarkers.expectedSchemaVersion,
      });
    },
    onSuccess: (res) => {
      if (selectedJobId) {
        queryClient.setQueryData(jobQueryKey(projectId, selectedJobId), { job: res.job });
      }
      invalidateJobQueries();
      const v = res.appliedVersionMeta;
      const s = res.applySummary;
      setPanelMessage({
        kind: 'success',
        title: 'Candidate применён к проекту',
        detail: `Версия #${v.versionNumber} (${v.id.slice(0, 8)}…), этажей: ${s.appliedObjectCounts.floors}, стен: ${s.appliedObjectCounts.walls}`,
      });

      if (!onEditorRefreshAfterApply) {
        return;
      }

      setPostApplyRefreshPending(true);
      void (async () => {
        try {
          await onEditorRefreshAfterApply();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setPanelMessage({
            kind: 'warning',
            title: 'Candidate применён на сервере',
            detail: `Не удалось автоматически подтянуть актуальную модель в редактор: ${msg}. Попробуйте кнопку «Обновить» в этой панели или перезагрузите страницу.`,
          });
        } finally {
          setPostApplyRefreshPending(false);
        }
      })();
    },
    onError: (e: unknown) => {
      let f = formatImportReviewError(e, 'Не удалось применить candidate');
      if (e instanceof SipApiError && e.apiBody.code === 'IMPORT_APPLY_CONCURRENCY_CONFLICT') {
        f = {
          ...f,
          detail: `${f.detail} ${IMPORT_REVIEW_UI.concurrencyHint}`,
        };
      }
      setPanelMessage({ kind: 'error', title: f.title, detail: f.detail, code: f.code });
    },
  });

  const listItems = useMemo(() => {
    const items = jobsQuery.data?.items ?? [];
    return [...items]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(mapImportJobToListItemViewModel);
  }, [jobsQuery.data?.items]);

  const detailVm = useMemo(() => {
    if (!job) return null;
    return mapImportJobToDetailViewModel(job, draftDecisions);
  }, [job, draftDecisions]);

  const summaryVm = useMemo((): ImportSummaryViewModel | null => {
    if (!job) return null;
    return mapImportSummaryViewModel(job);
  }, [job]);

  const onSelectJob = useCallback((id: string | null) => {
    setSelectedJobId(id);
    setPanelMessage(null);
  }, []);

  const jobSnapshot = job?.snapshot ?? null;

  const onFieldChange = useCallback(
    (
      field: RequiredDecisionFieldViewModel,
      raw: string | number | boolean | InternalBearingWallsInteractionPayload
    ) => {
      setPanelMessage(null);
      if (field.controlType === 'internalBearingWalls') {
        if (!jobSnapshot) return;
        setDraftDecisions((prev) =>
          applyInternalBearingWallsInteraction(prev, jobSnapshot, raw as InternalBearingWallsInteractionPayload)
        );
      } else {
        setDraftDecisions((prev) => applyFieldToDecisions(prev, field, raw as string | number | boolean));
      }
      setDecisionsDirty(true);
    },
    [jobSnapshot]
  );

  const onRefresh = useCallback(() => {
    setPanelMessage(null);
    void jobsQuery.refetch();
    void jobDetailQuery.refetch();
  }, [jobsQuery, jobDetailQuery]);

  const onSaveDraft = useCallback(() => {
    setPanelMessage(null);
    saveReviewMutation.mutate(draftDecisions);
  }, [saveReviewMutation, draftDecisions]);

  const onApplyReview = useCallback(() => {
    setPanelMessage(null);
    applyReviewFlowMutation.mutate({ dirty: decisionsDirty, decisions: draftDecisions });
  }, [applyReviewFlowMutation, decisionsDirty, draftDecisions]);

  const onPrepareCandidate = useCallback(() => {
    setPanelMessage(null);
    prepareMutation.mutate();
  }, [prepareMutation]);

  const onApplyCandidate = useCallback(() => {
    setPanelMessage(null);
    applyCandidateMutation.mutate();
  }, [applyCandidateMutation]);

  const anyMutationPending =
    saveReviewMutation.isPending ||
    applyReviewFlowMutation.isPending ||
    prepareMutation.isPending ||
    applyCandidateMutation.isPending ||
    postApplyRefreshPending;

  return {
    sipUserId,
    listItems,
    jobsLoading: jobsQuery.isLoading,
    jobsError: jobsQuery.isError,
    jobsErrorMessage: jobsQuery.error instanceof Error ? jobsQuery.error.message : null,
    selectedJobId,
    onSelectJob,
    job,
    detailVm,
    summaryVm,
    detailLoading: jobDetailQuery.isLoading,
    detailError: jobDetailQuery.isError,
    detailErrorMessage: jobDetailQuery.error instanceof Error ? jobDetailQuery.error.message : null,
    decisionsDirty,
    onFieldChange,
    onRefresh,
    onSaveDraft,
    onApplyReview,
    onPrepareCandidate,
    onApplyCandidate,
    saveReviewPending: saveReviewMutation.isPending,
    applyReviewPending: applyReviewFlowMutation.isPending,
    preparePending: prepareMutation.isPending,
    applyCandidatePending:
      applyCandidateMutation.isPending || postApplyRefreshPending,
    applyCandidateApiPending: applyCandidateMutation.isPending,
    postApplyEditorRefreshPending: postApplyRefreshPending,
    anyMutationPending,
    panelMessage,
    dismissMessage: () => setPanelMessage(null),
    versionMarkersReady: Boolean(versionMarkers),
    onRetryJobs: () => void jobsQuery.refetch(),
    onRetryJob: () => void jobDetailQuery.refetch(),
  };
}
