import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditorStore } from '@2wix/editor-core';
import { ExportPanel } from './ExportPanel';

vi.mock('../hooks/useSipProject', () => ({
  useSipExports: () => ({
    isLoading: false,
    data: {
      exports: [
        {
          id: 'e1',
          projectId: 'p1',
          versionId: 'v1',
          format: 'pdf',
          title: 't',
          createdAt: new Date().toISOString(),
          createdBy: 'u1',
          status: 'ready',
          fileName: 'a.pdf',
          storagePath: 'sip-exports/p1/v1/e1/a.pdf',
        },
        {
          id: 'e2',
          projectId: 'p1',
          versionId: 'v1',
          format: 'xlsx',
          title: 't2',
          createdAt: new Date().toISOString(),
          createdBy: 'u1',
          status: 'failed',
          fileName: 'b.xlsx',
          errorMessage: 'boom',
        },
        {
          id: 'e3',
          projectId: 'p1',
          versionId: 'v1',
          format: 'csv',
          title: 't3',
          createdAt: new Date().toISOString(),
          createdBy: 'u1',
          status: 'pending',
          fileName: 'c.csv',
        },
      ],
    },
  }),
  createProjectExport: vi.fn(async () => ({
    artifact: {
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      format: 'pdf',
      title: 't',
      createdAt: new Date().toISOString(),
      createdBy: 'u1',
      status: 'ready',
      fileName: 'a.pdf',
    },
    snapshot: {
      projectSummary: { projectId: 'p1', projectTitle: 'T', versionId: 'v1', versionNumber: 1, generatedBy: 'u1', floorsCount: 1 },
      wallSummaries: [],
      panelizationSummary: { eligibleWalls: 0, panelizedWalls: 0, generatedPanels: 0, warnings: 0, errors: 0 },
      specSummary: { totalPanels: 0, totalTrimmedPanels: 0, totalPanelAreaM2: 0, wallCountIncluded: 0, warningCount: 0 },
      aggregatedSpecItems: [],
      warnings: [],
      panelSettings: {
        defaultPanelTypeId: null,
        allowTrimmedPanels: true,
        minTrimWidthMm: 250,
        preferFullPanels: true,
        labelPrefixWall: 'W',
        labelPrefixRoof: 'R',
        labelPrefixSlab: 'S',
      },
      generatedAt: new Date().toISOString(),
      basedOnVersionId: 'v1',
    },
  })),
}));

vi.mock('../identity/sipUser', () => ({
  getSipUserId: () => 'u1',
}));

vi.mock('../api/projectsApi', () => ({
  getProjectExportDownloadUrl: vi.fn(async () => ({ url: 'https://example.com/a.pdf', fileName: 'a.pdf' })),
}));

describe('ExportPanel', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('renders buttons and exports list', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ExportPanel projectId="p1" versionId="v1" onSaveBeforeExport={async () => true} />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button', { name: /Скачать PDF/i })).toBeTruthy();
    expect(screen.getByText(/Последние выгрузки/i)).toBeTruthy();
    expect(screen.getAllByText(/Retry/i).length).toBeGreaterThan(0);
  });

  it('starts export actions', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ExportPanel projectId="p1" versionId="v1" onSaveBeforeExport={async () => true} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Скачать CSV/i })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: /Скачать XLSX/i })[0]!);
  });

  it('shows unsaved draft export choice', () => {
    useEditorStore.setState((s) => ({
      ...s,
      document: { ...s.document, hasUnsavedChanges: true },
    }));
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ExportPanel projectId="p1" versionId="v1" onSaveBeforeExport={async () => true} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Скачать PDF/i })[0]!);
    expect(screen.getByText(/Сохранить и экспортировать/i)).toBeTruthy();
    expect(screen.getByText(/Экспортировать текущую сохраненную версию/i)).toBeTruthy();
  });
});
