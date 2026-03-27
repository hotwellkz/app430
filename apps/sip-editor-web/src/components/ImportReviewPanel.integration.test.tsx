import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import { ImportReviewPanel } from './ImportReviewPanel';
import * as projectsApi from '@/api/projectsApi';
import { IMPORT_REVIEW_UI } from '@/import-review/constants/labels';
import { refreshEditorAfterApplyCandidate } from '@/editor/refreshEditorAfterApplyCandidate';
import { SipApiError } from '@/api/http';

vi.mock('@/api/projectsApi', () => ({
  listImportJobs: vi.fn(),
  getImportJob: vi.fn(),
  saveImportJobReview: vi.fn(),
  applyImportJobReview: vi.fn(),
  prepareImportJobEditorApply: vi.fn(),
  applyImportJobCandidateToProject: vi.fn(),
  getCurrentVersion: vi.fn(),
  getImportApplyHistory: vi.fn(),
}));

vi.mock('@/identity/sipUser', () => ({
  getSipUserId: () => 'user-1',
}));

const baseJob = {
  id: 'ij-1',
  projectId: 'p1',
  status: 'needs_review' as const,
  createdAt: '2026-03-27T12:00:00.000Z',
  updatedAt: '2026-03-27T12:00:00.000Z',
  createdBy: 'user-1',
  importSchemaVersion: 1,
  sourceImages: [{ id: 'i1', kind: 'plan' as const, fileName: 'p.png' }],
  snapshot: {
    projectMeta: {},
    floors: [{ id: 'f1' }],
    walls: [
      {
        id: 'w-int-1',
        floorId: 'f1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        typeHint: 'internal' as const,
        thicknessHintMm: 200,
      },
    ],
    openings: [],
    stairs: [],
    unresolved: [],
    notes: [],
  },
  review: {
    status: 'draft' as const,
    applyStatus: 'not_ready' as const,
    decisions: {},
    missingRequiredDecisions: [{ code: 'FLOOR_HEIGHTS_REQUIRED' as const, message: 'h', satisfied: false }],
    remainingBlockingIssueIds: [] as string[],
    isReadyToApply: false,
  },
  errorMessage: null as string | null,
};

function wrapper(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function firstJobRow(view: ReturnType<typeof within>) {
  const rows = view.queryAllByTestId('ir-job-row-ij-1');
  const el = rows[0];
  if (!el) throw new Error('expected import job row');
  return el;
}

describe('ImportReviewPanel integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads jobs list and opens selected job', async () => {
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [baseJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: baseJob });

    const { container } = render(wrapper(<ImportReviewPanel projectId="p1" versionMarkers={null} />));
    const view = within(container);

    await waitFor(() => expect(projectsApi.listImportJobs).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(view.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(view));
    await waitFor(() => expect(projectsApi.getImportJob).toHaveBeenCalledWith('p1', 'ij-1'));
    await waitFor(() => expect(view.getByText(IMPORT_REVIEW_UI.jobSummaryTitle)).toBeTruthy());
  });

  it('save review draft calls API', async () => {
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [baseJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: baseJob });
    vi.mocked(projectsApi.saveImportJobReview).mockResolvedValue({
      job: {
        ...baseJob,
        review: {
          ...baseJob.review,
          decisions: { floorHeightsMmByFloorId: { f1: 2800 } },
        },
      },
    });

    const { container } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v1',
            expectedVersionNumber: 1,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const view = within(container);

    await waitFor(() => expect(view.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(view));

    await view.findByText(/Высота этажа/i);

    const input = view.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2800' } });

    const saveBtns = view.queryAllByTestId('ir-save-draft');
    fireEvent.click(saveBtns[0]!);

    await waitFor(() =>
      expect(projectsApi.saveImportJobReview).toHaveBeenCalledWith(
        'p1',
        'ij-1',
        expect.objectContaining({
          updatedBy: 'user-1',
          decisions: expect.objectContaining({
            floorHeightsMmByFloorId: { f1: 2800 },
          }),
        })
      )
    );
  });

  it('apply review calls API when decisions complete', async () => {
    const readyJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [readyJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: readyJob });
    vi.mocked(projectsApi.applyImportJobReview).mockResolvedValue({
      job: {
        ...readyJob,
        review: {
          ...readyJob.review,
          status: 'applied',
          applyStatus: 'applied',
          reviewedSnapshot: null,
        },
      },
      reviewedSnapshot: {} as never,
    });

    const { container: c1 } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v1',
            expectedVersionNumber: 1,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const v1 = within(c1);

    await waitFor(() => expect(v1.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v1));
    await waitFor(() => expect(v1.queryAllByTestId('ir-apply-review').length).toBeGreaterThan(0));
    fireEvent.click(v1.queryAllByTestId('ir-apply-review')[0]!);

    await waitFor(() =>
      expect(projectsApi.applyImportJobReview).toHaveBeenCalledWith('p1', 'ij-1', {
        appliedBy: 'user-1',
      })
    );
  });

  it('prepare candidate calls API after review applied', async () => {
    const appliedJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [appliedJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: appliedJob });
    vi.mocked(projectsApi.prepareImportJobEditorApply).mockResolvedValue({
      job: {
        ...appliedJob,
        editorApply: {
          status: 'candidate_ready',
          errorMessage: null,
          generatedAt: 't',
          generatedBy: 'user-1',
          mapperVersion: 'm1',
        },
      },
      candidate: {
        model: {} as never,
        warnings: [],
        trace: [],
        mapperVersion: 'm1',
        generatedAt: 't',
        basedOnImportJobId: 'ij-1',
        basedOnReviewedSnapshotVersion: 'r1',
      },
    });

    const { container: c2 } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v1',
            expectedVersionNumber: 1,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const v2 = within(c2);

    await waitFor(() => expect(v2.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v2));
    await waitFor(() => expect(v2.queryAllByTestId('ir-prepare-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v2.queryAllByTestId('ir-prepare-candidate')[0]!);

    await waitFor(() =>
      expect(projectsApi.prepareImportJobEditorApply).toHaveBeenCalledWith('p1', 'ij-1', {
        generatedBy: 'user-1',
      })
    );
  });

  it('apply candidate calls API with concurrency markers', async () => {
    const candidateJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
      editorApply: {
        status: 'candidate_ready' as const,
        errorMessage: null,
        generatedAt: 't',
        generatedBy: 'user-1',
        mapperVersion: 'm1',
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [candidateJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: candidateJob });
    vi.mocked(projectsApi.applyImportJobCandidateToProject).mockResolvedValue({
      job: candidateJob,
      appliedVersionMeta: {
        id: 'ver-applied',
        projectId: 'p1',
        versionNumber: 3,
        schemaVersion: 2,
        createdAt: 't',
      },
      applySummary: {
        createdOrUpdatedVersionId: 'ver-applied',
        appliedObjectCounts: { floors: 1, walls: 0, openings: 0, slabs: 0, roofs: 0 },
        warningsCount: 0,
        traceCount: 0,
        basedOnImportJobId: 'ij-1',
        basedOnMapperVersion: 'm1',
        basedOnReviewedSnapshotVersion: 'r1',
      },
    });

    const { container: c3 } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v-curr',
            expectedVersionNumber: 2,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const v3 = within(c3);

    await waitFor(() => expect(v3.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v3));
    await waitFor(() => expect(v3.queryAllByTestId('ir-apply-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v3.queryAllByTestId('ir-apply-candidate')[0]!);

    await waitFor(() =>
      expect(projectsApi.applyImportJobCandidateToProject).toHaveBeenCalledWith('p1', 'ij-1', {
        appliedBy: 'user-1',
        expectedCurrentVersionId: 'v-curr',
        expectedVersionNumber: 2,
        expectedSchemaVersion: 2,
      })
    );
  });

  it('после успешного apply-candidate вызывается refresh (getCurrentVersion + bump)', async () => {
    const candidateJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
      editorApply: {
        status: 'candidate_ready' as const,
        errorMessage: null,
        generatedAt: 't',
        generatedBy: 'user-1',
        mapperVersion: 'm1',
      },
    };
    const bm = createEmptyBuildingModel();
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [candidateJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: candidateJob });
    vi.mocked(projectsApi.applyImportJobCandidateToProject).mockResolvedValue({
      job: candidateJob,
      appliedVersionMeta: {
        id: 'ver-applied',
        projectId: 'p1',
        versionNumber: 3,
        schemaVersion: 2,
        createdAt: 't',
      },
      applySummary: {
        createdOrUpdatedVersionId: 'ver-applied',
        appliedObjectCounts: { floors: 1, walls: 0, openings: 0, slabs: 0, roofs: 0 },
        warningsCount: 0,
        traceCount: 0,
        basedOnImportJobId: 'ij-1',
        basedOnMapperVersion: 'm1',
        basedOnReviewedSnapshotVersion: 'r1',
      },
    });
    vi.mocked(projectsApi.getCurrentVersion).mockResolvedValue({
      version: {
        id: 'ver-applied',
        projectId: 'p1',
        versionNumber: 3,
        schemaVersion: 2,
        buildingModel: bm,
        createdAt: 't',
        createdBy: null,
      },
    });
    vi.mocked(projectsApi.getImportApplyHistory).mockResolvedValue({ items: [] });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const bump = vi.fn();

    const { container } = render(
      <QueryClientProvider client={qc}>
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v-curr',
            expectedVersionNumber: 2,
            expectedSchemaVersion: 2,
          }}
          onEditorRefreshAfterApply={() =>
            refreshEditorAfterApplyCandidate(qc, 'p1', { onCacheUpdated: bump })
          }
        />
      </QueryClientProvider>
    );
    const v = within(container);

    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.queryAllByTestId('ir-apply-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v.queryAllByTestId('ir-apply-candidate')[0]!);

    await waitFor(() => expect(projectsApi.applyImportJobCandidateToProject).toHaveBeenCalled());
    await waitFor(() => expect(projectsApi.getCurrentVersion).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(bump).toHaveBeenCalled());
  });

  it('при ошибке apply-candidate refresh не вызывает getCurrentVersion', async () => {
    const candidateJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
      editorApply: {
        status: 'candidate_ready' as const,
        errorMessage: null,
        generatedAt: 't',
        generatedBy: 'user-1',
        mapperVersion: 'm1',
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [candidateJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: candidateJob });
    vi.mocked(projectsApi.applyImportJobCandidateToProject).mockRejectedValue(new Error('apply failed'));
    vi.mocked(projectsApi.getCurrentVersion).mockClear();

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const bump = vi.fn();

    const { container } = render(
      <QueryClientProvider client={qc}>
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v-curr',
            expectedVersionNumber: 2,
            expectedSchemaVersion: 2,
          }}
          onEditorRefreshAfterApply={() =>
            refreshEditorAfterApplyCandidate(qc, 'p1', { onCacheUpdated: bump })
          }
        />
      </QueryClientProvider>
    );
    const v = within(container);

    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.queryAllByTestId('ir-apply-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v.queryAllByTestId('ir-apply-candidate')[0]!);

    await waitFor(() => expect(projectsApi.applyImportJobCandidateToProject).toHaveBeenCalled());
    expect(projectsApi.getCurrentVersion).not.toHaveBeenCalled();
    expect(bump).not.toHaveBeenCalled();
  });

  it('конфликт apply-candidate: ошибка, без refresh', async () => {
    const candidateJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
      editorApply: {
        status: 'candidate_ready' as const,
        errorMessage: null,
        generatedAt: 't',
        generatedBy: 'user-1',
        mapperVersion: 'm1',
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [candidateJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: candidateJob });
    vi.mocked(projectsApi.applyImportJobCandidateToProject).mockRejectedValue(
      new SipApiError(409, {
        code: 'IMPORT_APPLY_CONCURRENCY_CONFLICT',
        message: 'Версия изменилась',
        status: 409,
      })
    );
    vi.mocked(projectsApi.getCurrentVersion).mockClear();

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={qc}>
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v-curr',
            expectedVersionNumber: 2,
            expectedSchemaVersion: 2,
          }}
          onEditorRefreshAfterApply={() =>
            refreshEditorAfterApplyCandidate(qc, 'p1', { onCacheUpdated: () => {} })
          }
        />
      </QueryClientProvider>
    );
    const v = within(container);

    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.queryAllByTestId('ir-apply-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v.queryAllByTestId('ir-apply-candidate')[0]!);

    await waitFor(() => expect(projectsApi.applyImportJobCandidateToProject).toHaveBeenCalled());
    expect(projectsApi.getCurrentVersion).not.toHaveBeenCalled();
  });

  it('если apply успешен, а post-refresh падает — показывается предупреждение', async () => {
    const candidateJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        status: 'applied' as const,
        applyStatus: 'applied' as const,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: false, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
        missingRequiredDecisions: [],
        isReadyToApply: true,
        reviewedSnapshot: {} as never,
      },
      editorApply: {
        status: 'candidate_ready' as const,
        errorMessage: null,
        generatedAt: 't',
        generatedBy: 'user-1',
        mapperVersion: 'm1',
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [candidateJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: candidateJob });
    vi.mocked(projectsApi.applyImportJobCandidateToProject).mockResolvedValue({
      job: candidateJob,
      appliedVersionMeta: {
        id: 'ver-applied',
        projectId: 'p1',
        versionNumber: 3,
        schemaVersion: 2,
        createdAt: 't',
      },
      applySummary: {
        createdOrUpdatedVersionId: 'ver-applied',
        appliedObjectCounts: { floors: 1, walls: 0, openings: 0, slabs: 0, roofs: 0 },
        warningsCount: 0,
        traceCount: 0,
        basedOnImportJobId: 'ij-1',
        basedOnMapperVersion: 'm1',
        basedOnReviewedSnapshotVersion: 'r1',
      },
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={qc}>
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v-curr',
            expectedVersionNumber: 2,
            expectedSchemaVersion: 2,
          }}
          onEditorRefreshAfterApply={() => Promise.reject(new Error('sync failed'))}
        />
      </QueryClientProvider>
    );
    const v = within(container);

    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.queryAllByTestId('ir-apply-candidate').length).toBeGreaterThan(0));
    fireEvent.click(v.queryAllByTestId('ir-apply-candidate')[0]!);

    await waitFor(() =>
      expect(v.getByText('Candidate применён на сервере')).toBeTruthy()
    );
    expect(v.getByText(/sync failed/)).toBeTruthy();
  });

  it('internal bearing: да без выбранных стен — apply-review disabled', async () => {
    const job = {
      ...baseJob,
      review: {
        ...baseJob.review,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [job] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job });

    const { container } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v1',
            expectedVersionNumber: 1,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const v = within(container);
    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.getByTestId('ir-internal-bearing-section')).toBeTruthy());
    expect((v.getByTestId('ir-apply-review') as HTMLButtonElement).disabled).toBe(true);
  });

  it('internal bearing: выбор стены включает apply-review', async () => {
    const readyJob = {
      ...baseJob,
      review: {
        ...baseJob.review,
        decisions: {
          floorHeightsMmByFloorId: { f1: 2800 },
          internalBearingWalls: { confirmed: true, wallIds: [] },
          scale: { mode: 'confirmed' as const, mmPerPixel: null },
        },
      },
    };
    vi.mocked(projectsApi.listImportJobs).mockResolvedValue({ items: [readyJob] });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: readyJob });
    vi.mocked(projectsApi.applyImportJobReview).mockResolvedValue({
      job: {
        ...readyJob,
        review: {
          ...readyJob.review,
          status: 'applied' as const,
          applyStatus: 'applied' as const,
          reviewedSnapshot: null,
        },
      },
      reviewedSnapshot: {} as never,
    });

    const { container } = render(
      wrapper(
        <ImportReviewPanel
          projectId="p1"
          versionMarkers={{
            expectedCurrentVersionId: 'v1',
            expectedVersionNumber: 1,
            expectedSchemaVersion: 2,
          }}
        />
      )
    );
    const v = within(container);
    await waitFor(() => expect(v.queryAllByTestId('ir-job-row-ij-1').length).toBeGreaterThan(0));
    fireEvent.click(firstJobRow(v));
    await waitFor(() => expect(v.getByTestId('ir-wall-cb-w-int-1')).toBeTruthy());
    expect((v.getByTestId('ir-apply-review') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(v.getByTestId('ir-wall-cb-w-int-1'));
    await waitFor(() => expect((v.getByTestId('ir-apply-review') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(v.getByTestId('ir-apply-review'));
    await waitFor(() =>
      expect(projectsApi.applyImportJobReview).toHaveBeenCalledWith('p1', 'ij-1', {
        appliedBy: 'user-1',
      })
    );
  });
});
