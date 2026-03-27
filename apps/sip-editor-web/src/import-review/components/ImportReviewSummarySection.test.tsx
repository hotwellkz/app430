/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import type { ImportJob } from '@2wix/shared-types';
import { IMPORT_SUMMARY_UI } from '../constants/labels';
import { mapImportSummaryViewModel } from '../viewModel/importSummaryMapper';
import { formatImportSummaryForClipboard } from '../utils/formatImportSummaryForClipboard';
import { ImportReviewSummarySection } from './ImportReviewSummarySection';

function jobBase(over: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'j1',
    projectId: 'p1',
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u1',
    importSchemaVersion: 1,
    sourceImages: [],
    snapshot: {
      projectMeta: {},
      floors: [{ id: 'f1', label: 'Этаж 1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    errorMessage: null,
    ...over,
  };
}

describe('ImportReviewSummarySection', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('partial: нет review — показы hint', () => {
    const vm = mapImportSummaryViewModel(jobBase({ review: undefined }));
    render(<ImportReviewSummarySection vm={vm} />);
    expect(screen.getAllByTestId('ir-summary-saved-hint')[0]?.textContent).toContain('не начат');
  });

  it('candidate: hint пока review не применён', () => {
    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: { floorHeightsMmByFloorId: { f1: 2800 } },
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: false,
        },
      })
    );
    render(<ImportReviewSummarySection vm={vm} />);
    expect(screen.getAllByTestId('ir-summary-candidate-hint')[0]?.textContent).toBe(
      IMPORT_SUMMARY_UI.hintReviewNotAppliedForCandidate
    );
  });

  it('applied: project block с версией', () => {
    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        projectApply: {
          status: 'applied',
          appliedVersionNumber: 3,
          appliedVersionId: 'ver-abc',
          appliedAt: '2026-01-02T12:00:00.000Z',
          appliedBy: 'user-x',
          summary: {
            createdOrUpdatedVersionId: 'ver-abc',
            appliedObjectCounts: { floors: 1, walls: 0, openings: 0, slabs: 0, roofs: 0 },
            warningsCount: 0,
            traceCount: 0,
            basedOnImportJobId: 'j1',
            basedOnMapperVersion: 'mv',
            basedOnReviewedSnapshotVersion: 'rs',
          },
        },
      })
    );
    render(<ImportReviewSummarySection vm={vm} />);
    expect(screen.getAllByTestId('ir-summary-project-lines')[0]?.textContent).toMatch(/3/);
  });

  it('ready candidate: строки счётчиков', () => {
    const model = createEmptyBuildingModel();
    model.floors = [{ id: 'fl1', label: 'F', elevationMm: 0, sortOrder: 0 }];
    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        editorApply: {
          status: 'candidate_ready',
          candidate: {
            model,
            warnings: [],
            trace: [],
            mapperVersion: 'm1',
            generatedAt: '2026-01-01T00:00:00.000Z',
            basedOnImportJobId: 'j1',
            basedOnReviewedSnapshotVersion: 'rs',
            status: 'ready',
          },
        },
      })
    );
    render(<ImportReviewSummarySection vm={vm} />);
    expect(screen.getAllByTestId('ir-summary-candidate-lines')[0]?.textContent).toMatch(/этажей/);
  });

  it('кнопка копирования вызывает clipboard.writeText с текстом formatter', async () => {
    const vm = mapImportSummaryViewModel(jobBase({ review: undefined }));
    const expected = formatImportSummaryForClipboard(vm);
    render(<ImportReviewSummarySection vm={vm} />);
    const btn = screen.getByTestId('ir-summary-copy');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expected);
    });
    expect(screen.getByTestId('ir-summary-copy-feedback').textContent).toBe(IMPORT_SUMMARY_UI.copySummarySuccess);
  });

  it('при ошибке clipboard показывается предупреждение', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const vm = mapImportSummaryViewModel(jobBase({ review: undefined }));
    render(<ImportReviewSummarySection vm={vm} />);
    fireEvent.click(screen.getByTestId('ir-summary-copy'));
    await waitFor(() => {
      expect(screen.getByTestId('ir-summary-copy-feedback').textContent).toBe(IMPORT_SUMMARY_UI.copySummaryError);
    });
  });

  it('кнопка disabled если нет pipeline badges', () => {
    const vm = mapImportSummaryViewModel(jobBase({ review: undefined }));
    const broken = { ...vm, pipelineBadges: [] };
    render(<ImportReviewSummarySection vm={broken} />);
    expect((screen.getByTestId('ir-summary-copy') as HTMLButtonElement).disabled).toBe(true);
  });
});
