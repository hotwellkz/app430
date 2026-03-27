import {
  useImportReviewPanel,
  type VersionConcurrencyMarkers,
} from '@/hooks/useImportReviewPanel';
import { ImportReviewPanelView } from '@/import-review/components/ImportReviewPanelView';

export function ImportReviewPanel({
  projectId,
  versionMarkers,
}: {
  projectId: string;
  versionMarkers: VersionConcurrencyMarkers | null;
}) {
  const p = useImportReviewPanel(projectId, versionMarkers);

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
      anyMutationPending={p.anyMutationPending}
      reviewApplied={reviewApplied}
      panelMessage={p.panelMessage}
      onDismissMessage={p.dismissMessage}
    />
  );
}
