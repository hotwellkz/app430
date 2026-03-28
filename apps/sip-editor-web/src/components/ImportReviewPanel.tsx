import {
  useImportReviewPanel,
  type VersionConcurrencyMarkers,
} from '@/hooks/useImportReviewPanel';
import { ImportReviewPanelView } from '@/import-review/components/ImportReviewPanelView';

export function ImportReviewPanel({
  projectId,
  versionMarkers,
  onEditorRefreshAfterApply,
  pendingSelectJobId,
  onPendingSelectConsumed,
}: {
  projectId: string;
  versionMarkers: VersionConcurrencyMarkers | null;
  /** После успешного apply-candidate: обновить current version и документ редактора без F5 */
  onEditorRefreshAfterApply?: () => Promise<void>;
  pendingSelectJobId?: string | null;
  onPendingSelectConsumed?: () => void;
}) {
  const p = useImportReviewPanel(projectId, versionMarkers, {
    onEditorRefreshAfterApply,
    pendingSelectJobId: pendingSelectJobId ?? null,
    onPendingSelectConsumed,
  });

  const reviewApplied = p.job?.review?.status === 'applied';

  return (
    <ImportReviewPanelView
      listItems={p.listItems}
      jobsLoading={p.jobsLoading}
      jobsError={p.jobsError}
      jobsErrorMessage={p.jobsErrorMessage}
      onRetryJobs={p.onRetryJobs}
      selectedJobId={p.selectedJobId}
      onSelectJob={p.onSelectJob}
      detailVm={p.detailVm}
      summaryVm={p.summaryVm}
      detailLoading={p.detailLoading}
      detailError={p.detailError}
      detailErrorMessage={p.detailErrorMessage}
      onRetryJob={p.onRetryJob}
      onRefresh={p.onRefresh}
      refreshDisabled={p.anyMutationPending}
      onFieldChange={p.onFieldChange}
      onSaveDraft={p.onSaveDraft}
      onApplyReview={p.onApplyReview}
      onPrepareCandidate={p.onPrepareCandidate}
      onApplyCandidate={p.onApplyCandidate}
      canSaveReview={Boolean(p.detailVm?.canSaveReview)}
      canApplyReview={Boolean(p.detailVm?.canApplyReview)}
      canPrepareCandidate={Boolean(p.detailVm?.canPrepareCandidate)}
      canApplyCandidate={Boolean(p.detailVm?.canApplyCandidate)}
      versionMarkersReady={p.versionMarkersReady}
      saveReviewPending={p.saveReviewPending}
      applyReviewPending={p.applyReviewPending}
      preparePending={p.preparePending}
      applyCandidatePending={p.applyCandidatePending}
      applyCandidateApiPending={p.applyCandidateApiPending}
      postApplyEditorRefreshPending={p.postApplyEditorRefreshPending}
      anyMutationPending={p.anyMutationPending}
      reviewApplied={reviewApplied}
      panelMessage={p.panelMessage}
      onDismissMessage={p.dismissMessage}
      geometryDiagnostics={p.job?.editorApply?.candidate?.geometryDiagnostics ?? null}
      rawImportSnapshot={p.job?.snapshot ?? null}
      transformedSnapshotForDebug={p.job?.review?.reviewedSnapshot?.transformedSnapshot ?? null}
      planImageUrlForDebug={p.job?.sourceImages?.find((i) => i.kind === 'plan')?.fileUrl ?? null}
      candidateModelForDebug={p.job?.editorApply?.candidate?.model ?? null}
    />
  );
}
