import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IMPORT_REVIEW_UI } from '../constants/labels';
import type { ImportReviewJobViewModel } from '../viewModel/importReviewViewModel.types';
import { ImportReviewPanelView } from './ImportReviewPanelView';

function detailVm(overrides?: Partial<ImportReviewJobViewModel>): ImportReviewJobViewModel {
  return {
    id: 'job-1',
    createdAtLabel: '01.01.2026, 10:00',
    jobIdShort: 'job-1',
    extractionStatus: 'needs_review',
    extractionStatusLabel: 'Нужен review',
    reviewStatus: 'draft',
    reviewStatusLabel: 'Черновик',
    candidateStatus: 'draft',
    candidateStatusLabel: 'Не подготовлен',
    projectApplyStatus: 'draft',
    projectApplyStatusLabel: 'Не применялся',
    sourceImagesCount: 1,
    unresolvedCount: 0,
    missingRequiredDecisionsCount: 1,
    remainingBlockingIssuesCount: 0,
    isReadyToApply: false,
    canSaveReview: true,
    canApplyReview: false,
    canPrepareCandidate: false,
    canApplyCandidate: false,
    requiredFields: [
      {
        key: 'floorHeight:f1',
        label: 'Высота f1',
        controlType: 'floorHeightMm',
        value: '',
        floorId: 'f1',
        isRequired: true,
        isMissing: true,
      },
    ],
    issues: [],
    errorMessage: null,
    headerStatusLine: 'Нужен review · Черновик',
    ...overrides,
  };
}

const defaultProps = {
  listItems: [
    {
      id: 'job-1',
      createdAtLabel: '01.01.2026',
      jobIdShort: 'job-1',
      extractionStatus: 'needs_review',
      extractionStatusLabel: 'Нужен review',
      reviewStatus: 'draft',
      reviewStatusLabel: 'Черновик',
    },
  ],
  jobsLoading: false,
  jobsError: false,
  jobsErrorMessage: null,
  onRetryJobs: vi.fn(),
  selectedJobId: 'job-1' as string | null,
  onSelectJob: vi.fn(),
  detailVm: detailVm(),
  detailLoading: false,
  detailError: false,
  detailErrorMessage: null,
  onRetryJob: vi.fn(),
  onRefresh: vi.fn(),
  refreshDisabled: false,
  onFieldChange: vi.fn(),
  onSaveDraft: vi.fn(),
  onApplyReview: vi.fn(),
  onPrepareCandidate: vi.fn(),
  onApplyCandidate: vi.fn(),
  canSaveReview: true,
  canApplyReview: false,
  canPrepareCandidate: false,
  canApplyCandidate: false,
  versionMarkersReady: true,
  saveReviewPending: false,
  applyReviewPending: false,
  preparePending: false,
  applyCandidatePending: false,
  applyCandidateApiPending: false,
  postApplyEditorRefreshPending: false,
  anyMutationPending: false,
  reviewApplied: false,
  panelMessage: null,
  onDismissMessage: vi.fn(),
};

describe('ImportReviewPanelView', () => {
  it('shows post-apply editor refresh label on button', () => {
    render(
      <ImportReviewPanelView
        {...defaultProps}
        canApplyCandidate
        applyCandidatePending
        applyCandidateApiPending={false}
        postApplyEditorRefreshPending
        anyMutationPending
      />
    );
    expect(screen.getByText('Обновление редактора…')).toBeTruthy();
  });

  it('shows loading jobs', () => {
    render(<ImportReviewPanelView {...defaultProps} jobsLoading listItems={[]} selectedJobId={null} />);
    expect(screen.getByText(IMPORT_REVIEW_UI.loadingJobs)).toBeTruthy();
  });

  it('shows empty jobs', () => {
    render(
      <ImportReviewPanelView
        {...defaultProps}
        listItems={[]}
        selectedJobId={null}
        detailVm={null}
      />
    );
    expect(screen.getByText(IMPORT_REVIEW_UI.noJobs)).toBeTruthy();
  });

  it('shows error with retry', () => {
    render(
      <ImportReviewPanelView
        {...defaultProps}
        jobsError
        jobsErrorMessage="boom"
        listItems={[]}
        selectedJobId={null}
        detailVm={null}
      />
    );
    expect(screen.getByText('boom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: IMPORT_REVIEW_UI.retry }));
    expect(defaultProps.onRetryJobs).toHaveBeenCalled();
  });

  it('renders missing decision field and disables apply', () => {
    const { container } = render(<ImportReviewPanelView {...defaultProps} />);
    expect(container.textContent).toMatch(/Высота f1/i);
    const applyBtn = container.querySelector('[data-testid="ir-apply-review"]');
    expect(applyBtn).toBeTruthy();
    expect((applyBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables apply when vm allows', () => {
    const { container } = render(
      <ImportReviewPanelView
        {...defaultProps}
        detailVm={detailVm({
          canApplyReview: true,
          isReadyToApply: true,
          missingRequiredDecisionsCount: 0,
        })}
        canApplyReview
      />
    );
    const applyBtn = container.querySelector('[data-testid="ir-apply-review"]');
    expect(applyBtn).toBeTruthy();
    expect((applyBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows success panel message', () => {
    render(
      <ImportReviewPanelView
        {...defaultProps}
        panelMessage={{ kind: 'success', title: 'OK', detail: 'done' }}
      />
    );
    expect(screen.getByText('OK')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(defaultProps.onDismissMessage).toHaveBeenCalled();
  });

  it('disables apply candidate without version markers', () => {
    const { container } = render(
      <ImportReviewPanelView
        {...defaultProps}
        detailVm={detailVm({ canApplyCandidate: true })}
        canApplyCandidate
        versionMarkersReady={false}
      />
    );
    const btn = container.querySelector('[data-testid="ir-apply-candidate"]');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
