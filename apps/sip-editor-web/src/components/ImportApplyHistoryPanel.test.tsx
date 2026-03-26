import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ImportApplyHistoryViewItem } from '@/import-history/importApplyHistoryViewModel';
import { ImportApplyHistoryPanelView } from './ImportApplyHistoryPanelView';
import type { MissingFieldUiItem } from '@/import-history/importHistoryMissingFields';

function item(overrides?: Partial<ImportApplyHistoryViewItem>): ImportApplyHistoryViewItem {
  const missingFieldUiItems: MissingFieldUiItem[] = [];
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
    missingFieldUiItems,
    missingFieldsCompact: '',
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
        totalCount={0}
        activeFilter="all"
        onFilterChange={() => {}}
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
        totalCount={0}
        activeFilter="all"
        onFilterChange={() => {}}
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
        totalCount={1}
        activeFilter="all"
        onFilterChange={() => {}}
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
            missingFields: ['appliedAt', 'reviewedSnapshotVersion', 'importJobId'],
            missingFieldsCompact: 'Время применения, Версия reviewed snapshot +1 еще',
            missingFieldUiItems: [
              { key: 'appliedAt', label: 'Время применения' },
              { key: 'reviewedSnapshotVersion', label: 'Версия reviewed snapshot' },
              { key: 'importJobId', label: 'ID import-job' },
            ],
            subtitle: 'Неполная legacy запись: Время применения, Версия reviewed snapshot',
          }),
        ]}
        totalCount={1}
        activeFilter="all"
        onFilterChange={() => {}}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Incomplete legacy/i)).toBeTruthy();
    expect(screen.getAllByText(/Неполная legacy запись/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Время применения, Версия reviewed snapshot \+1 еще/i)).toBeTruthy();
    expect(screen.queryByText('appliedAt')).toBeNull();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError
        errorMessage="network"
        items={[]}
        totalCount={0}
        activeFilter="all"
        onFilterChange={() => {}}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText(/Не удалось загрузить историю AI-import/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Повторить/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('filters items by selected mode and shows filter-empty message', () => {
    const onFilterChange = vi.fn();
    const view = render(
      <ImportApplyHistoryPanelView
        isLoading={false}
        isError={false}
        errorMessage={null}
        items={[]}
        totalCount={2}
        activeFilter="incomplete"
        onFilterChange={onFilterChange}
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Для выбранного фильтра записей нет/i)).toBeTruthy();
    fireEvent.click(within(view.container).getByRole('button', { name: 'legacy' }));
    expect(onFilterChange).toHaveBeenCalledWith('legacy');
  });
});
