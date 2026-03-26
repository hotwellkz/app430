import {
  getFloorById,
  getOpeningsByFloor,
  getWallsByFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Floor, FloorType } from '@2wix/shared-types';

type FloorFieldPatch = Partial<
  Pick<Floor, 'label' | 'level' | 'elevationMm' | 'heightMm' | 'floorType' | 'sortIndex'>
>;

const FLOOR_TYPE_OPTIONS: { value: FloorType; label: string }[] = [
  { value: 'full', label: 'Полный этаж' },
  { value: 'mansard', label: 'Мансарда' },
  { value: 'basement', label: 'Подвал / цоколь' },
];

export function FloorInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const view = useEditorStore((s) => s.view);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);

  const floorId =
    selection.selectedObjectType === 'floor' && selection.selectedObjectId
      ? selection.selectedObjectId
      : view.activeFloorId;

  if (!draft || !floorId) {
    return (
      <p className="twix-muted" style={{ fontSize: 13 }}>
        Добавьте этаж или выберите его в списке слева.
      </p>
    );
  }

  const floor = getFloorById(draft, floorId);
  if (!floor) {
    return (
      <p className="twix-muted" style={{ fontSize: 13 }}>
        Этаж не найден в модели.
      </p>
    );
  }

  const patch = (p: FloorFieldPatch) => {
    applyCommand({ type: 'updateFloor', floorId, patch: p });
  };

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Этаж</p>
      <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
        <dt className="twix-muted">Название</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            value={floor.label}
            onChange={(e) => patch({ label: e.target.value })}
            style={{ width: '100%', padding: 6, border: '1px solid var(--twix-border)', borderRadius: 4 }}
          />
        </dd>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={floor.floorType}
            onChange={(e) => patch({ floorType: e.target.value as FloorType })}
            style={{ width: '100%', padding: 4 }}
          >
            {FLOOR_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </dd>
        <dt className="twix-muted">Уровень (номер)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={1}
            step={1}
            value={floor.level}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isFinite(v)) return;
              patch({ level: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Отметка низа (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            step={10}
            value={floor.elevationMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              patch({ elevationMm: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Высота этажа (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={1}
            step={10}
            value={floor.heightMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              patch({ heightMm: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Порядок в списке</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            step={1}
            value={floor.sortIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              patch({ sortIndex: Math.round(v) });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
      </dl>
      <p className="twix-muted" style={{ fontSize: 11, marginTop: 10 }}>
        На этаже: стен {getWallsByFloor(draft, floorId).length}, проёмов{' '}
        {getOpeningsByFloor(draft, floorId).length}
      </p>
    </div>
  );
}
