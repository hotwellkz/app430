import {
  buildDraftSipBomSnapshot,
  getFloorsSorted,
  getFloorById,
  getOpeningsByFloor,
  getRoofForTopFloor,
  getSlabsByFloor,
  getWallsByFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { useMemo } from 'react';

const saveRu: Record<string, string> = {
  idle: 'ожидание',
  dirty: 'есть изменения',
  saving: 'сохранение…',
  saved: 'сохранено',
  conflict: 'конфликт версии',
  error: 'ошибка',
};

export function BuildingSummaryPanel({ projectIsTemplate }: { projectIsTemplate?: boolean } = {}) {
  const draft = useEditorStore((s) => s.document.draftModel);
  const document = useEditorStore((s) => s.document);
  const view = useEditorStore((s) => s.view);

  if (!draft) return null;

  const fid = view.activeFloorId;
  const activeFloor = fid ? getFloorById(draft, fid) : undefined;
  const walls = fid ? getWallsByFloor(draft, fid).length : 0;
  const openings = fid ? getOpeningsByFloor(draft, fid).length : 0;
  const slabsOnFloor = fid ? getSlabsByFloor(draft, fid).length : 0;
  const totalSlabs = draft.slabs.length;
  const roof = getRoofForTopFloor(draft);
  const floorsSorted = getFloorsSorted(draft);
  const draftBom = useMemo(() => buildDraftSipBomSnapshot(draft), [draft]);

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
        {projectIsTemplate ? (
          <>
            <dt className="twix-muted">Тип в каталоге</dt>
            <dd style={{ margin: 0, color: '#4338ca', fontWeight: 600 }}>шаблон</dd>
          </>
        ) : null}
        <dt className="twix-muted">Этажей</dt>
        <dd style={{ margin: 0 }}>{draft.floors.length}</dd>
        <dt className="twix-muted">Активный этаж</dt>
        <dd style={{ margin: 0 }}>{activeFloor ? activeFloor.label : '—'}</dd>
        <dt className="twix-muted">Отметка активного этажа</dt>
        <dd style={{ margin: 0 }}>{activeFloor ? `${activeFloor.elevationMm} мм` : '—'}</dd>
        <dt className="twix-muted">Высота активного этажа</dt>
        <dd style={{ margin: 0 }}>{activeFloor ? `${activeFloor.heightMm} мм` : '—'}</dd>
        <dt className="twix-muted">Стен на этаже</dt>
        <dd style={{ margin: 0 }}>{walls}</dd>
        <dt className="twix-muted">Проёмов на этаже</dt>
        <dd style={{ margin: 0 }}>{openings}</dd>
        <dt className="twix-muted">Перекрытий (этаж / всего)</dt>
        <dd style={{ margin: 0 }}>{slabsOnFloor} / {totalSlabs}</dd>
        <dt className="twix-muted">Крыша</dt>
        <dd style={{ margin: 0 }}>{roof ? `${roof.roofType} (${roof.slopeDegrees}°)` : 'нет'}</dd>
        <dt className="twix-muted">Верхний этаж</dt>
        <dd style={{ margin: 0 }}>{floorsSorted[floorsSorted.length - 1]?.label ?? '—'}</dd>
        <dt className="twix-muted">SIP черновик (проект)</dt>
        <dd style={{ margin: 0 }}>
          {draftBom.project.wallsWithLayout > 0 ? (
            <>
              панелей {draftBom.project.sipPanelsTotal} · trim {draftBom.project.trimPanelsTotal} · ready / partial / invalid:{' '}
              {draftBom.project.wallsReady} / {draftBom.project.wallsPartial} / {draftBom.project.wallsInvalid} · stale{' '}
              {draftBom.project.staleLayouts}
            </>
          ) : (
            <span className="twix-muted">нет сохранённых раскладок</span>
          )}
        </dd>
        {fid && draftBom.byFloor.some((x) => x.floorId === fid) ? (
          <>
            <dt className="twix-muted">SIP черновик (этаж)</dt>
            <dd style={{ margin: 0 }}>
              {(() => {
                const f = draftBom.byFloor.find((x) => x.floorId === fid);
                if (!f) return '—';
                return (
                  <>
                    панелей {f.sipPanelsTotal} · trim {f.trimPanelsTotal} · ready/partial/invalid {f.wallsReady}/{f.wallsPartial}/
                    {f.wallsInvalid} · stale {f.staleLayouts}
                  </>
                );
              })()}
            </dd>
          </>
        ) : null}
        <dt className="twix-muted">Версия модели</dt>
        <dd style={{ margin: 0 }}>{document.currentVersionNumber ?? '—'}</dd>
        <dt className="twix-muted">Сохранение</dt>
        <dd style={{ margin: 0 }}>{saveRu[document.saveStatus] ?? document.saveStatus}</dd>
      </dl>
    </div>
  );
}
