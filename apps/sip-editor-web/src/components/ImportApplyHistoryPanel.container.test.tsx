import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImportApplyHistoryPanel } from './ImportApplyHistoryPanel';

vi.mock('../hooks/useImportApplyHistory', () => ({
  useImportApplyHistory: () => ({
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    data: {
      items: [
        {
          id: 'v1',
          appliedAt: '2026-03-26T12:00:00.000Z',
          appliedBy: 'alice',
          importJobId: 'ij-alpha',
          mapperVersion: 'm1',
          reviewedSnapshotVersion: 'r1',
          warningsCount: 0,
          traceCount: 1,
          isLegacy: false,
          isIncomplete: false,
          missingFields: [],
          missingFieldUiItems: [],
          missingFieldsCompact: '',
          badgeKind: 'neutral',
          badgeLabel: 'AI import',
          subtitle: 'normal',
          isInspectable: false,
        },
        {
          id: 'v2',
          appliedAt: '2026-03-24T12:00:00.000Z',
          appliedBy: 'bob',
          importJobId: 'ij-beta',
          mapperVersion: 'm1',
          reviewedSnapshotVersion: 'r1',
          warningsCount: 1,
          traceCount: 2,
          isLegacy: true,
          isIncomplete: true,
          missingFields: ['appliedAt'],
          missingFieldUiItems: [{ key: 'appliedAt', label: 'Время применения' }],
          missingFieldsCompact: 'Время применения',
          badgeKind: 'danger',
          badgeLabel: 'Incomplete legacy',
          subtitle: 'legacy',
          isInspectable: false,
        },
      ],
    },
  }),
}));

describe('ImportApplyHistoryPanel container', () => {
  it('changes rendered list by filter and search', () => {
    render(<ImportApplyHistoryPanel projectId="p1" />);
    expect(screen.getByText(/job: ij-alpha/i)).toBeTruthy();
    expect(screen.getByText(/job: ij-beta/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'normal (1)' }));
    expect(screen.getByText(/job: ij-alpha/i)).toBeTruthy();
    expect(screen.queryByText(/job: ij-beta/i)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Поиск: importJobId или appliedBy/i), {
      target: { value: 'bob' },
    });
    expect(screen.getByText(/По вашему запросу ничего не найдено/i)).toBeTruthy();
  });
});
