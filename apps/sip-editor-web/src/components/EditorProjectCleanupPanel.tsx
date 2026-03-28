import type { CSSProperties } from 'react';
import { getFloorById } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';

export function EditorProjectCleanupPanel() {
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const view = useEditorStore((s) => s.view);
  const draft = useEditorStore((s) => s.document.draftModel);
  const fid = view.activeFloorId;
  const floorLabel =
    fid && draft ? getFloorById(draft, fid)?.label ?? fid : '—';

  const btn: CSSProperties = {
    display: 'block',
    width: '100%',
    marginBottom: 6,
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid var(--twix-border)',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: '1px solid var(--twix-border)',
        borderRadius: 8,
        background: 'var(--twix-surface, #fff)',
        fontSize: 12,
      }}
    >
      <p className="twix-panelTitle" style={{ marginBottom: 8 }}>
        Очистка слоёв
      </p>
      <p className="twix-muted" style={{ marginBottom: 8 }}>
        Активный этаж: <strong>{floorLabel}</strong>. Действия с undo/redo.
      </p>
      <button
        type="button"
        style={btn}
        disabled={!fid}
        onClick={() => {
          if (!fid) return;
          if (
            !window.confirm(
              `Удалить все стены активного этажа «${floorLabel}»? Проёмы на этих стенах также будут удалены.`
            )
          ) {
            return;
          }
          applyCommand({ type: 'clearFloorWallsLayer', floorId: fid });
        }}
      >
        Очистить стены активного этажа
      </button>
      <button
        type="button"
        style={btn}
        disabled={!fid}
        onClick={() => {
          if (!fid) return;
          if (
            !window.confirm(
              `Удалить все проёмы на активном этаже «${floorLabel}»? Стены останутся.`
            )
          ) {
            return;
          }
          applyCommand({ type: 'clearFloorOpeningsLayer', floorId: fid });
        }}
      >
        Очистить проёмы активного этажа
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => {
          if (
            !window.confirm(
              'Удалить фундамент и стяжки (плиты пола) по всему проекту?'
            )
          ) {
            return;
          }
          applyCommand({ type: 'clearFoundationLayer' });
        }}
      >
        Очистить фундамент и стяжки
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => {
          if (
            !window.confirm(
              'Удалить все перекрытия (плиты) по всему проекту?'
            )
          ) {
            return;
          }
          applyCommand({ type: 'clearSlabsLayer' });
        }}
      >
        Очистить перекрытие
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => {
          if (!window.confirm('Удалить все крыши по проекту?')) {
            return;
          }
          applyCommand({ type: 'clearRoofsLayer' });
        }}
      >
        Очистить крышу
      </button>
    </div>
  );
}
