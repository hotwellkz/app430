import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ImportApplyHistoryViewItem } from '@/import-history/importApplyHistoryViewModel';
import { ImportApplyHistoryPanelView } from './ImportApplyHistoryPanelView';

function item(overrides?: Partial<ImportApplyHistoryViewItem>): ImportApplyHistoryViewItem {
  return {
    id: 'v1',
    appliedAt: '2026-03-26T12:00:00.000Z',
    appliedBy: 'u1',
    importJobId: 'ij-1234',
    mapperVersion: 'import-candidate-v1',
    reviewedSnapshotVersion: 'r1',
    warningsCount: 1,
    traceCount: 2,
    isLegacy: false,
    isIncomplete: false,
    missingFields: [],
    badgeKind: 'neutral',
    badgeLabel: 'AI import',
    subtitle: 'by u1 · mapper import-candidate-v1 · warnings 1',
    isInspectable: false,
    ...overrides,
  };
}

describe('ImportApplyHistoryPanelView', () => {
  it('renders loading state', () => {
    render(
      <ImportApplyHistoryPanelView
        isLoading
        isError={false}
        errorMessage={null}
        items={[]}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Загрузка истории AI-import/i)).toBeTruthy();
  });

  it('renders empty state', () => {
    render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError={false}
        errorMessage={null}
        items={[]}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/История AI-import пока пуста/i)).toBeTruthy();
  });

  it('renders normal item', () => {
    render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError={false}
        errorMessage={null}
        items={[item()]}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/AI import/i)).toBeTruthy();
    expect(screen.getByText(/mapper: import-candidate-v1/i)).toBeTruthy();
  });

  it('renders incomplete legacy marker and missing fields', () => {
    render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError={false}
        errorMessage={null}
        items={[
          item({
            isLegacy: true,
            isIncomplete: true,
            badgeKind: 'danger',
            badgeLabel: 'Incomplete legacy',
            missingFields: ['appliedAt', 'reviewedSnapshotVersion'],
            subtitle: 'Неполная legacy запись: appliedAt, reviewedSnapshotVersion',
          }),
        ]}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Incomplete legacy/i)).toBeTruthy();
    expect(screen.getAllByText(/Неполная legacy запись/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/appliedAt, reviewedSnapshotVersion/i).length).toBeGreaterThan(0);
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError
        errorMessage="network"
        items={[]}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText(/Не удалось загрузить историю AI-import/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Повторить/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
