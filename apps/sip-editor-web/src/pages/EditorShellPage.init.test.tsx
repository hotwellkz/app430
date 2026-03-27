import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import type { ProjectVersion } from '@2wix/shared-types';
import { useEditorStore } from '@2wix/editor-core';
import { EditorShellPage } from './EditorShellPage';

vi.mock('@/identity/sipUser', () => ({
  getSipUserId: () => 'u1',
  resolveSipUserContext: () => ({ source: 'query' }),
}));

vi.mock('@/api/projectsApi', () => ({
  createVersion: vi.fn(),
  patchCurrentVersion: vi.fn(),
}));

vi.mock('@/editor/refreshEditorAfterApplyCandidate', () => ({
  refreshEditorAfterApplyCandidate: vi.fn(async () => undefined),
}));

vi.mock('@/components/VersionsPanel', () => ({ VersionsPanel: () => <div>VersionsPanel</div> }));
vi.mock('@/components/EditorLeftSidebar', () => ({ EditorLeftSidebar: () => <div>EditorLeftSidebar</div> }));
vi.mock('@/components/BuildingSummaryPanel', () => ({ BuildingSummaryPanel: () => <div>BuildingSummaryPanel</div> }));
vi.mock('@/components/BuildingWarningsPanel', () => ({ BuildingWarningsPanel: () => <div>BuildingWarningsPanel</div> }));
vi.mock('@/components/PanelizationPanel', () => ({ PanelizationPanel: () => <div>PanelizationPanel</div> }));
vi.mock('@/components/SpecPanel', () => ({ SpecPanel: () => <div>SpecPanel</div> }));
vi.mock('@/components/ExportPanel', () => ({ ExportPanel: () => <div>ExportPanel</div> }));
vi.mock('@/components/ImportApplyHistoryPanel', () => ({ ImportApplyHistoryPanel: () => <div>ImportApplyHistoryPanel</div> }));
vi.mock('@/components/ImportReviewPanel', () => ({ ImportReviewPanel: () => <div>ImportReviewPanel</div> }));
vi.mock('@/import-wizard/AiImportWizardModal', () => ({ AiImportWizardModal: () => null }));
vi.mock('@/components/FloorInspector', () => ({ FloorInspector: () => <div>FloorInspector</div> }));
vi.mock('@/components/OpeningInspector', () => ({ OpeningInspector: () => <div>OpeningInspector</div> }));
vi.mock('@/components/RoofInspector', () => ({ RoofInspector: () => <div>RoofInspector</div> }));
vi.mock('@/components/SlabInspector', () => ({ SlabInspector: () => <div>SlabInspector</div> }));
vi.mock('@/components/WallInspector', () => ({ WallInspector: () => <div>WallInspector</div> }));
vi.mock('@/components/Preview3DPanel', () => ({ Preview3DPanel: () => <div>Preview3DPanel</div> }));
vi.mock('@/canvas2d/EditorCanvas2D', () => ({ EditorCanvas2D: () => <div>EditorCanvas2D</div> }));
vi.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));

type QueryStub<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => Promise<unknown>;
};

const projectStub: QueryStub<{ project: { id: string; title: string; updatedAt: string; status: string; dealId: string | null; currentVersionId: string | null } }> = {
  data: {
    project: {
      id: 'p1',
      title: 'Project',
      updatedAt: '2025-01-01T00:00:00.000Z',
      status: 'draft',
      dealId: null,
      currentVersionId: 'v1',
    },
  },
  isLoading: false,
  isError: false,
  refetch: async () => ({}),
};

const versionModel = createEmptyBuildingModel();
const versionStub: QueryStub<{ version: ProjectVersion }> = {
  data: {
    version: {
      id: 'v1',
      projectId: 'p1',
      versionNumber: 1,
      schemaVersion: 2,
      buildingModel: versionModel,
      createdAt: '2025-01-01T00:00:00.000Z',
      createdBy: 'u1',
    },
  },
  isLoading: false,
  isError: false,
  refetch: async () => ({}),
};

const versionsListStub: QueryStub<{ versions: ProjectVersion[] }> = {
  data: { versions: [] },
  isLoading: false,
  isError: false,
  refetch: async () => ({}),
};

let projectQueryMock: QueryStub<any> = projectStub;
let currentVersionQueryMock: QueryStub<any> = versionStub;
let versionsQueryMock: QueryStub<any> = versionsListStub;

vi.mock('@/hooks/useSipProject', () => ({
  useSipProject: () => projectQueryMock,
  useSipCurrentVersion: () => currentVersionQueryMock,
  useSipVersionsList: () => versionsQueryMock,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/sip-editor/p1?sipUserId=u1']}>
        <Routes>
          <Route path="/sip-editor/:projectId" element={<EditorShellPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EditorShellPage init flow', () => {
  beforeEach(() => {
    cleanup();
    useEditorStore.getState().reset();
    projectQueryMock = projectStub;
    currentVersionQueryMock = versionStub;
    versionsQueryMock = versionsListStub;
  });

  it('does not hang on missing current-version payload', async () => {
    currentVersionQueryMock = {
      data: {} as { version: ProjectVersion },
      isLoading: false,
      isError: false,
      refetch: async () => ({}),
    };

    renderPage();
    expect(screen.getByText('Текущая версия не получена')).toBeTruthy();
    expect(screen.queryByText('Инициализация модели…')).toBeNull();
  });

  it('shows explicit error state when current-version query fails', async () => {
    currentVersionQueryMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: async () => ({}),
    };

    renderPage();
    expect(screen.getAllByText('Версия не загружена').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Повторить' }).length).toBeGreaterThan(0);
  });

  it('renders normal shell for valid existing project', async () => {
    renderPage();
    expect((await screen.findAllByTestId('editor-toolbar-ai-import')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Инициализация модели…')).toBeNull();
    expect(screen.queryByText('Версия не загружена')).toBeNull();
    expect(screen.queryByText('Текущая версия не получена')).toBeNull();
  });

  it('smoke: opens fresh project in empty working state', async () => {
    currentVersionQueryMock = {
      data: {
        version: {
          id: 'v-fresh',
          projectId: 'p1',
          versionNumber: 1,
          schemaVersion: 2,
          buildingModel: createEmptyBuildingModel(),
          createdAt: '2025-01-01T00:00:00.000Z',
          createdBy: 'u1',
        },
      },
      isLoading: false,
      isError: false,
      refetch: async () => ({}),
    };

    renderPage();
    expect((await screen.findAllByTestId('editor-toolbar-ai-import')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Загрузка проекта…')).toBeNull();
    expect(screen.queryByText('Версия не загружена')).toBeNull();
    expect(screen.queryByText('Текущая версия не получена')).toBeNull();
  });

  it('smoke: fallback path still opens editor when version resolved', async () => {
    // Симулируем уже отработавший API fallback /versions после 404 /current-version.
    currentVersionQueryMock = {
      data: {
        version: {
          id: 'v-from-versions',
          projectId: 'p1',
          versionNumber: 1,
          schemaVersion: 2,
          buildingModel: createEmptyBuildingModel(),
          createdAt: '2025-01-01T00:00:00.000Z',
          createdBy: 'u1',
        },
      },
      isLoading: false,
      isError: false,
      refetch: async () => ({}),
    };

    renderPage();
    expect((await screen.findAllByTestId('editor-toolbar-ai-import')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Версия не загружена')).toBeNull();
    expect(screen.queryByText('Текущая версия не получена')).toBeNull();
  });
});
