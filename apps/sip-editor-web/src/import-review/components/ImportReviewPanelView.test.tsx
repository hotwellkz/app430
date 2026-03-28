import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImportJob } from '@2wix/shared-types';
import { IMPORT_REVIEW_UI, IMPORT_SUMMARY_UI } from '../constants/labels';
import type { ImportReviewJobViewModel } from '../viewModel/importReviewViewModel.types';
import { mapImportSummaryViewModel } from '../viewModel/importSummaryMapper';
import { ImportReviewPanelView } from './ImportReviewPanelView';

function minimalJobForSummary(): ImportJob {
  return {
    id: 'job-1',
    projectId: 'p1',
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u1',
    importSchemaVersion: 1,
    sourceImages: [{ id: 'x', kind: 'plan', fileName: 'a.png' }],
    snapshot: null,
    review: {
      status: 'draft',
      applyStatus: 'not_ready',
      decisions: {},
      missingRequiredDecisions: [],
      remainingBlockingIssueIds: [],
      isReadyToApply: false,
    },
    errorMessage: null,
  };
}

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
  summaryVm: mapImportSummaryViewModel(minimalJobForSummary()),
  geometryDiagnostics: null,
  rawImportSnapshot: null,
  candidateModelForDebug: null,
};

describe('ImportReviewPanelView', () => {
  afterEach(() => {
    cleanup();
  });

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
        summaryVm={null}
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
        summaryVm={null}
      />
    );
    expect(screen.getByText('boom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: IMPORT_REVIEW_UI.retry }));
    expect(defaultProps.onRetryJobs).toHaveBeenCalled();
  });

  it('renders import summary section', () => {
    render(<ImportReviewPanelView {...defaultProps} />);
    expect(screen.getAllByTestId('ir-import-summary').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Сводка импорта').length).toBeGreaterThanOrEqual(1);
  });

  it('копирование сводки: clipboard получает текст со «Сводка AI-импорта»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ImportReviewPanelView {...defaultProps} />);
    fireEvent.click(screen.getByTestId('ir-summary-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toMatch(/Сводка AI-импорта/);
    expect(screen.getByTestId('ir-summary-copy-feedback').textContent).toBe(IMPORT_SUMMARY_UI.copySummarySuccess);
  });

  it('сводка без candidate/projectApply: копирование даёт fallback-блоки', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const summaryVm = mapImportSummaryViewModel(minimalJobForSummary());
    render(<ImportReviewPanelView {...defaultProps} summaryVm={summaryVm} />);
    fireEvent.click(screen.getByTestId('ir-summary-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toMatch(/недоступен|ещё не подготовлено/);
    expect(text).toMatch(/не применяли|ещё не применено/);
  });

  it('renders missing decision field and disables apply', () => {
    const { container } = render(<ImportReviewPanelView {...defaultProps} />);
    expect(container.textContent).toMatch(/Высота f1/i);
    const applyBtn = container.querySelector('[data-testid="ir-apply-review"]');
    expect(applyBtn).toBeTruthy();
    expect((applyBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders internal bearing wall checkboxes when mode yes', () => {
    const base = detailVm();
    render(
      <ImportReviewPanelView
        {...defaultProps}
        detailVm={{
          ...base,
          requiredFields: [
            {
              key: 'internalBearingWalls',
              label: 'Внутренние несущие стены',
              controlType: 'internalBearingWalls',
              value: { mode: 'yes', wallIds: [] },
              internalBearingMode: 'yes',
              internalBearingWallRows: [
                {
                  wallId: 'w1',
                  floorLabel: 'Этаж 1',
                  typeLabel: 'Внутренняя',
                  subtitle: '2 точ.',
                },
              ],
              internalBearingCandidatesEmpty: false,
              isRequired: true,
              isMissing: true,
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId('ir-internal-bearing-section')).toBeTruthy();
    expect(screen.getByTestId('ir-wall-cb-w1')).toBeTruthy();
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
