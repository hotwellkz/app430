import {
  getFloorById,
  getOpeningsByFloor,
  getWallsByFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';

const saveRu: Record<string, string> = {
  idle: 'ожидание',
  dirty: 'есть изменения',
  saving: 'сохранение…',
  saved: 'сохранено',
  conflict: 'конфликт версии',
  error: 'ошибка',
};

export function BuildingSummaryPanel() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const document = useEditorStore((s) => s.document);
  const view = useEditorStore((s) => s.view);

  if (!draft) return null;

  const fid = view.activeFloorId;
  const activeFloor = fid ? getFloorById(draft, fid) : undefined;
  const walls = fid ? getWallsByFloor(draft, fid).length : 0;
  const openings = fid ? getOpeningsByFloor(draft, fid).length : 0;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: '1px solid var(--twix-border)',
        borderRadius: 8,
        background: 'var(--twix-surface, #f8fafc)',
        fontSize: 12,
      }}
    >
      <p className="twix-panelTitle" style={{ marginBottom: 8 }}>
        Объект
      </p>
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">Этажей</dt>
        <dd style={{ margin: 0 }}>{draft.floors.length}</dd>
        <dt className="twix-muted">Активный этаж</dt>
        <dd style={{ margin: 0 }}>{activeFloor ? activeFloor.label : '—'}</dd>
        <dt className="twix-muted">Стен на этаже</dt>
        <dd style={{ margin: 0 }}>{walls}</dd>
        <dt className="twix-muted">Проёмов на этаже</dt>
        <dd style={{ margin: 0 }}>{openings}</dd>
        <dt className="twix-muted">Версия модели</dt>
        <dd style={{ margin: 0 }}>{document.currentVersionNumber ?? '—'}</dd>
        <dt className="twix-muted">Сохранение</dt>
        <dd style={{ margin: 0 }}>{saveRu[document.saveStatus] ?? document.saveStatus}</dd>
      </dl>
    </div>
  );
}
