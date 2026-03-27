import {
  useImportReviewPanel,
  type VersionConcurrencyMarkers,
} from '@/hooks/useImportReviewPanel';
import { ImportReviewPanelView } from '@/import-review/components/ImportReviewPanelView';

export function ImportReviewPanel({
  projectId,
  versionMarkers,
  onEditorRefreshAfterApply,
}: {
  projectId: string;
  versionMarkers: VersionConcurrencyMarkers | null;
  /** После успешного apply-candidate: обновить current version и документ редактора без F5 */
  onEditorRefreshAfterApply?: () => Promise<void>;
}) {
  const p = useImportReviewPanel(projectId, versionMarkers, { onEditorRefreshAfterApply });

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
    />
  );
}
