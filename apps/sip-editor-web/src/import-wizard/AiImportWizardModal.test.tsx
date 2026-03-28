import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SipApiError } from '@/api/http';
import { AiImportWizardModal } from './AiImportWizardModal';
import * as projectsApi from '@/api/projectsApi';

vi.mock('@/api/projectsApi', () => ({
  createImportJob: vi.fn(),
  getImportJob: vi.fn(),
  saveImportJobReview: vi.fn(),
  uploadImportSourceFile: vi.fn(),
}));

vi.mock('@/identity/sipUser', () => ({
  getSipUserId: () => 'user-1',
}));

const mockSnapshot = {
  projectMeta: {},
  floors: [{ id: 'f1' }],
  walls: [],
  openings: [],
  stairs: [],
  unresolved: [],
  notes: [],
};

const readyJob = {
  id: 'job-new',
  projectId: 'p1',
  status: 'needs_review' as const,
  createdAt: '2026-03-27T12:00:00.000Z',
  updatedAt: '2026-03-27T12:00:00.000Z',
  createdBy: 'user-1',
  importSchemaVersion: 1,
  sourceImages: [{ id: 'a1', kind: 'plan' as const, fileName: 'x.png' }],
  snapshot: mockSnapshot,
  review: null,
  errorMessage: null as string | null,
};

function wrap(ui: ReactElement) {
  return ui;
}

/** В тестовом окружении иногда два role=dialog (Strict Mode) — берём последний. */
function wizardScreen() {
  const dialogs = screen.getAllByRole('dialog');
  return within(dialogs[dialogs.length - 1]!);
}

function wizardFileInput(): HTMLInputElement {
  return wizardScreen().getByTestId('ai-import-wizard-file-input') as HTMLInputElement;
}

describe('AiImportWizardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.uploadImportSourceFile).mockImplementation(async (_pid, p) => ({
      asset: {
        id: p.id,
        kind: p.kind,
        fileName: p.file.name,
        mimeType: p.file.type || 'image/png',
        storageProvider: 'firebase',
        bucket: 'test-bucket',
        storagePath: `sip-import-sources/p1/${p.id}/${p.file.name}`,
        sizeBytes: p.file.size,
      },
    }));
    vi.mocked(projectsApi.createImportJob).mockResolvedValue({ job: { ...readyJob, status: 'running' as const } });
    vi.mocked(projectsApi.getImportJob).mockResolvedValue({ job: readyJob });
    vi.mocked(projectsApi.saveImportJobReview).mockResolvedValue({ ok: true } as never);
  });

  it('opens and closes without dirty state', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      wrap(
        <AiImportWizardModal
          open
          onClose={onClose}
          projectId="p1"
          projectTitle="T"
          onSuccess={vi.fn()}
        />
      )
    );
    expect(wizardScreen().getByText('Импорт по фото / планам')).toBeTruthy();
    fireEvent.click(wizardScreen().getByText('Отмена'));
    expect(onClose).toHaveBeenCalled();
    rerender(
      wrap(
        <AiImportWizardModal
          open={false}
          onClose={onClose}
          projectId="p1"
          projectTitle="T"
          onSuccess={vi.fn()}
        />
      )
    );
  });

  it('adds file via input and removes', () => {
    render(
      wrap(
        <AiImportWizardModal open onClose={vi.fn()} projectId="p1" projectTitle="T" onSuccess={vi.fn()} />
      )
    );
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(wizardFileInput(), { target: { files: [file] } });
    expect(wizardScreen().getByText('a.png')).toBeTruthy();
    fireEvent.click(wizardScreen().getByText('Удалить'));
    expect(wizardScreen().queryByText('a.png')).toBeNull();
  });

  it('disables submit when validation fails on step 3', async () => {
    render(
      wrap(
        <AiImportWizardModal open onClose={vi.fn()} projectId="p1" projectTitle="T" onSuccess={vi.fn()} />
      )
    );
    fireEvent.change(wizardFileInput(), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    const ws = wizardScreen();
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    const h1 = ws.getByDisplayValue('2800');
    fireEvent.change(h1, { target: { value: '0' } });
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    const submit = ws.getByTestId('ai-import-wizard-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('runs create flow and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      wrap(
        <AiImportWizardModal
          open
          onClose={onClose}
          projectId="p1"
          projectTitle="T"
          onSuccess={onSuccess}
        />
      )
    );
    fireEvent.change(wizardFileInput(), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    const ws = wizardScreen();
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-submit'));

    await waitFor(() => expect(projectsApi.uploadImportSourceFile).toHaveBeenCalled());
    await waitFor(() => expect(projectsApi.createImportJob).toHaveBeenCalled());
    await waitFor(() => expect(projectsApi.saveImportJobReview).toHaveBeenCalled());
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('job-new'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows error when upload fails and does not create import', async () => {
    vi.mocked(projectsApi.uploadImportSourceFile).mockRejectedValueOnce(
      new SipApiError(400, {
        code: 'INTERNAL_ERROR',
        message: 'Файл слишком больший',
        status: 400,
      })
    );
    render(
      wrap(
        <AiImportWizardModal open onClose={vi.fn()} projectId="p1" projectTitle="T" onSuccess={vi.fn()} />
      )
    );
    fireEvent.change(wizardFileInput(), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    const ws = wizardScreen();
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-submit'));
    await waitFor(() => {
      const err = screen.queryAllByTestId('ai-import-wizard-error').pop();
      expect(err?.textContent ?? '').toContain('больший');
    });
    expect(projectsApi.createImportJob).not.toHaveBeenCalled();
  });

  it('shows error when createImportJob fails', async () => {
    vi.mocked(projectsApi.createImportJob).mockRejectedValueOnce(new Error('network'));
    render(
      wrap(
        <AiImportWizardModal open onClose={vi.fn()} projectId="p1" projectTitle="T" onSuccess={vi.fn()} />
      )
    );
    fireEvent.change(wizardFileInput(), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    const ws = wizardScreen();
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-next'));
    fireEvent.click(ws.getByTestId('ai-import-wizard-submit'));
    await waitFor(() => {
      const err = screen.queryAllByTestId('ai-import-wizard-error').pop();
      expect(err?.textContent ?? '').toContain('network');
    });
  });
});
