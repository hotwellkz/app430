/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SipProjectsPage } from './SipProjectsPage';
import type { SipProjectRow } from '../lib/sip/sipTypes';

vi.mock('../hooks/useCurrentSipUser', () => ({
  useCurrentSipUser: () => ({
    sipUserId: 'u1',
    loading: false,
    isAuthenticated: true,
  }),
}));

const mockList = vi.fn();
const mockDelete = vi.fn();

vi.mock('../lib/sip/sipApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sip/sipApi')>();
  return {
    ...actual,
    sipListProjects: (...args: unknown[]) => mockList(...args),
    sipDeleteProject: (...args: unknown[]) => mockDelete(...args),
  };
});

vi.mock('../lib/sip/sipEditorUrl', () => ({
  openSipEditorWindow: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function sampleProject(over: Partial<SipProjectRow> = {}): SipProjectRow {
  return {
    id: 'p1',
    dealId: 'deal-1',
    title: 'Demo',
    status: 'draft',
    currentVersionId: 'v1',
    currentVersionNumber: 1,
    schemaVersion: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    createdBy: 'u1',
    updatedBy: 'u1',
    ...over,
  };
}

describe('SipProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([sampleProject()]);
    mockDelete.mockResolvedValue(undefined);
  });

  it('показывает таблицу и счётчик проектов', async () => {
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-project-row-p1')).toBeTruthy());
    expect(screen.getByTestId('sip-projects-count').textContent ?? '').toContain('Проектов: 1');
  });

  it('открывает подтверждение удаления и отмена закрывает без вызова API', async () => {
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-actions-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-actions-p1'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-trigger-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-trigger-p1'));
    await waitFor(() => expect(screen.getByText('Удалить проект?')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-cancel'));
    await waitFor(() => expect(screen.queryByText('Удалить проект?')).toBeNull());
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('подтверждение удаления вызывает sipDeleteProject и убирает строку', async () => {
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-actions-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-actions-p1'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-trigger-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-trigger-p1'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-confirm'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByTestId('sip-project-row-p1')).toBeNull());
  });

  it('после удаления последнего проекта показывается empty state', async () => {
    mockList.mockResolvedValueOnce([sampleProject({ id: 'only', title: 'Only' })]);
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-project-row-only')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-actions-only'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-trigger-only')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-trigger-only'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-confirm'));
    await waitFor(() => expect(screen.getByTestId('sip-global-empty')).toBeTruthy());
  });

  it('пустой поиск: сообщение и сброс', async () => {
    mockList.mockResolvedValue([sampleProject(), sampleProject({ id: 'p2', title: 'Other' })]);
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-project-row-p1')).toBeTruthy());
    const input = screen.getByPlaceholderText(/Поиск по названию/);
    fireEvent.change(input, { target: { value: 'zzz-no-match' } });
    await waitFor(() => expect(screen.getByTestId('sip-search-empty')).toBeTruthy());
    fireEvent.click(screen.getByText('Сбросить поиск'));
    await waitFor(() => expect(screen.getByTestId('sip-project-row-p1')).toBeTruthy());
  });

  it('ошибка удаления не убирает строку', async () => {
    mockDelete.mockRejectedValueOnce(new Error('network'));
    render(<SipProjectsPage />);
    await waitFor(() => expect(screen.getByTestId('sip-actions-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-actions-p1'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-trigger-p1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-trigger-p1'));
    await waitFor(() => expect(screen.getByTestId('sip-delete-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sip-delete-confirm'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(screen.getByTestId('sip-project-row-p1')).toBeTruthy();
  });
});
