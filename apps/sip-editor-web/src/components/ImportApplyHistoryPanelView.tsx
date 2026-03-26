import type { CSSProperties } from 'react';
import { EmptyState, LoadingState } from '@2wix/ui-kit';
import type { ImportApplyHistoryViewItem } from '../import-history/importApplyHistoryViewModel';
import type { ImportHistoryFilter } from '../import-history/importHistoryFilters';
import type { ImportHistoryCounters } from '../import-history/importHistoryCounts';
import type { ImportHistorySortMode } from '../import-history/importHistorySort';

function badgeStyle(kind: ImportApplyHistoryViewItem['badgeKind']): CSSProperties {
  if (kind === 'danger') {
    return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
  }
  if (kind === 'warning') {
    return { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' };
  }
  return { background: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe' };
}

interface ItemProps {
  item: ImportApplyHistoryViewItem;
}

function ImportApplyHistoryItemCard({ item }: ItemProps) {
  return (
    <li
      style={{
        listStyle: 'none',
        border: '1px solid var(--twix-border)',
        borderRadius: 8,
        padding: 10,
        background: 'var(--twix-surface, #fff)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>{new Date(item.appliedAt).toLocaleString('ru-RU')}</strong>
        <span
          style={{
            ...badgeStyle(item.badgeKind),
            fontSize: 10,
            borderRadius: 999,
            padding: '2px 8px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {item.badgeLabel}
        </span>
      </div>
      <p className="twix-muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
        {item.subtitle}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 11 }}>
        <span>user: {item.appliedBy}</span>
        <span>job: {item.importJobId}</span>
        <span>mapper: {item.mapperVersion}</span>
        <span>trace: {item.traceCount}</span>
        <span>warnings: {item.warningsCount}</span>
        <span>inspect: {item.isInspectable ? 'yes' : 'no'}</span>
      </div>
      {item.isLegacy && item.isIncomplete ? (
        <div
          style={{
            marginTop: 8,
            borderRadius: 6,
            border: '1px solid #fca5a5',
            background: '#fff1f2',
            padding: '6px 8px',
            fontSize: 11,
          }}
        >
          <strong>Неполная legacy запись</strong>
          <div className="twix-muted" style={{ marginTop: 4 }}>
            missing: {item.missingFieldsCompact}
          </div>
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer' }}>Показать все missing поля</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              {item.missingFieldUiItems.map((field) => (
                <li key={field.key} title={field.hint}>
                  {field.label}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </li>
  );
}

export interface ImportApplyHistoryPanelViewProps {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  items: ImportApplyHistoryViewItem[];
  totalCount: number;
  counters: ImportHistoryCounters;
  activeFilter: ImportHistoryFilter;
  onFilterChange: (next: ImportHistoryFilter) => void;
  searchQuery: string;
  onSearchChange: (next: string) => void;
  sortMode: ImportHistorySortMode;
  onSortModeChange: (next: ImportHistorySortMode) => void;
  onRetry: () => void;
}

export function ImportApplyHistoryPanelView(props: ImportApplyHistoryPanelViewProps) {
  const {
    isLoading,
    isError,
    errorMessage,
    items,
    totalCount,
    counters,
    activeFilter,
    onFilterChange,
    searchQuery,
    onSearchChange,
    sortMode,
    onSortModeChange,
    onRetry,
  } = props;
  const isSearchEmpty = !isLoading && !isError && searchQuery.trim().length > 0 && items.length === 0;
  const isFilterEmpty =
    !isLoading &&
    !isError &&
    searchQuery.trim().length === 0 &&
    activeFilter !== 'all' &&
    items.length === 0;
  const isAllEmpty =
    !isLoading &&
    !isError &&
    searchQuery.trim().length === 0 &&
    activeFilter === 'all' &&
    items.length === 0;
  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid var(--twix-border)', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <p className="twix-panelTitle" style={{ marginBottom: 8 }}>
          AI-import history
        </p>
        <span className="twix-muted" style={{ fontSize: 11 }}>
          записей: {totalCount}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ fontSize: 11 }} onClick={() => onFilterChange('all')} disabled={activeFilter === 'all'}>
          all ({counters.all})
        </button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => onFilterChange('normal')} disabled={activeFilter === 'normal'}>
          normal ({counters.normal})
        </button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => onFilterChange('legacy')} disabled={activeFilter === 'legacy'}>
          legacy ({counters.legacy})
        </button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => onFilterChange('incomplete')} disabled={activeFilter === 'incomplete'}>
          incomplete ({counters.incomplete})
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Поиск: importJobId или appliedBy"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
        />
        <select
          value={sortMode}
          onChange={(e) => onSortModeChange(e.target.value as ImportHistorySortMode)}
          style={{ fontSize: 12 }}
        >
          <option value="newest">newest</option>
          <option value="oldest">oldest</option>
        </select>
      </div>
      {isLoading ? <LoadingState message="Загрузка истории AI-import…" /> : null}
      {!isLoading && isError ? (
        <div style={{ fontSize: 12 }}>
          <p style={{ margin: 0 }}>Не удалось загрузить историю AI-import.</p>
          <p className="twix-muted" style={{ margin: '4px 0 8px' }}>
            {errorMessage ?? 'Попробуйте ещё раз.'}
          </p>
          <button type="button" onClick={onRetry} style={{ fontSize: 12 }}>
            Повторить
          </button>
        </div>
      ) : null}
      {isAllEmpty ? (
        <EmptyState title="История AI-import пока пуста" description="Записи появятся после apply-candidate." />
      ) : null}
      {isFilterEmpty ? (
        <EmptyState title="Для выбранного фильтра записей нет" description="Смените фильтр, чтобы увидеть другие записи." />
      ) : null}
      {isSearchEmpty ? (
        <EmptyState
          title="По вашему запросу ничего не найдено"
          description="Проверьте importJobId или appliedBy и попробуйте другой запрос."
        />
      ) : null}
      {!isLoading && !isError && items.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <ImportApplyHistoryItemCard key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
