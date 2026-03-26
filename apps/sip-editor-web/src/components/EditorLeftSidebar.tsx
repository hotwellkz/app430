import { useState } from 'react';
import {
  createFloor,
  getFloorsSorted,
  getOpeningsByFloor,
  getWallsByFloor,
  suggestNextFloor,
} from '@2wix/domain-model';
import type { ActivePanel } from '@2wix/editor-core';
import { useEditorStore } from '@2wix/editor-core';
import { Sidebar, SidebarNavButton } from '@2wix/ui-kit';
import type { FloorType } from '@2wix/shared-types';

const SECTIONS: { id: ActivePanel; label: string }[] = [
  { id: 'project', label: 'Проект' },
  { id: 'floors', label: 'Этажи' },
  { id: 'walls', label: 'Стены' },
  { id: 'openings', label: 'Проёмы' },
  { id: 'roof', label: 'Кровля' },
  { id: 'slabs', label: 'Плиты' },
  { id: 'versions', label: 'Версии' },
];

function floorTypeShort(t: FloorType): string {
  if (t === 'full') return 'полн.';
  if (t === 'mansard') return 'манс.';
  return 'подв.';
}

export function EditorLeftSidebar() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const view = useEditorStore((s) => s.view);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const selectObject = useEditorStore((s) => s.selectObject);

  const [menuFloorId, setMenuFloorId] = useState<string | null>(null);

  const activePanel = view.activePanel;
  const floorId = view.activeFloorId;
  const wallsOnFloor =
    draft && floorId ? getWallsByFloor(draft, floorId) : [];
  const openingsOnFloor =
    draft && floorId ? getOpeningsByFloor(draft, floorId) : [];

  const wallShort = (wallId: string) => {
    const w = wallsOnFloor.find((x) => x.id === wallId);
    return w ? `${w.id.slice(0, 6)}…` : wallId.slice(0, 6) + '…';
  };

  const openingTypeRu = (t: string) => {
    if (t === 'window') return 'окно';
    if (t === 'door') return 'дверь';
    if (t === 'portal') return 'портал';
    return t;
  };

  const addFloor = () => {
    if (!draft) return;
    const f = createFloor(suggestNextFloor(draft));
    const r = applyCommand({ type: 'addFloor', floor: f });
    if (r.ok) setActiveFloor(f.id);
  };

  const duplicateFloor = (id: string) => {
    setMenuFloorId(null);
    applyCommand({ type: 'duplicateFloor', sourceFloorId: id });
  };

  const deleteFloor = (id: string, label: string) => {
    setMenuFloorId(null);
    if (
      !window.confirm(
        `Удалить этаж «${label}»?\nВсе стены и проёмы на этом этаже будут удалены. Это действие можно отменить (Undo).`
      )
    ) {
      return;
    }
    applyCommand({ type: 'deleteFloor', floorId: id });
  };

  const sortedFloors = draft ? getFloorsSorted(draft) : [];

  return (
    <Sidebar>
      {SECTIONS.map((s) => (
        <SidebarNavButton
          key={s.id}
          label={s.label}
          active={activePanel === s.id}
          onClick={() => setActivePanel(s.id)}
        />
      ))}
      {draft && activePanel !== 'versions' ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--twix-border, #e2e8f0)',
            fontSize: 12,
            maxHeight: '42vh',
            overflow: 'auto',
          }}
        >
          <p className="twix-panelTitle" style={{ fontSize: 11 }}>
            Этажи
          </p>
          <button
            type="button"
            style={{ fontSize: 11, marginBottom: 8, marginRight: 6 }}
            onClick={addFloor}
          >
            + Добавить этаж
          </button>
          <ul style={{ margin: '4px 0', padding: 0, listStyle: 'none' }}>
            {sortedFloors.map((f) => {
              const active = floorId === f.id;
              return (
                <li
                  key={f.id}
                  style={{
                    marginBottom: 6,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px solid ${active ? 'var(--twix-accent, #2563eb)' : 'var(--twix-border, #e2e8f0)'}`,
                    background: active ? 'rgba(37,99,235,0.06)' : 'transparent',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFloor(f.id);
                      selectObject(f.id, 'floor');
                      setActivePanel('floors');
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                      fontSize: 12,
                    }}
                  >
                    {f.label}
                  </button>
                  <div className="twix-muted" style={{ fontSize: 10, marginTop: 2 }}>
                    H {f.heightMm} мм · отм. {f.elevationMm} мм · {floorTypeShort(f.floorType)}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button
                      type="button"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => duplicateFloor(f.id)}
                    >
                      Дублировать
                    </button>
                    <button
                      type="button"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => setMenuFloorId((m) => (m === f.id ? null : f.id))}
                    >
                      Ещё…
                    </button>
                  </div>
                  {menuFloorId === f.id ? (
                    <div style={{ marginTop: 4, paddingLeft: 4 }}>
                      <button
                        type="button"
                        style={{ fontSize: 10, display: 'block', marginBottom: 4 }}
                        onClick={() => {
                          setMenuFloorId(null);
                          setActiveFloor(f.id);
                          selectObject(f.id, 'floor');
                          setActivePanel('floors');
                        }}
                      >
                        Свойства (справа)
                      </button>
                      {sortedFloors.length > 1 ? (
                        <button
                          type="button"
                          style={{ fontSize: 10, color: '#b91c1c' }}
                          onClick={() => deleteFloor(f.id, f.label)}
                        >
                          Удалить этаж…
                        </button>
                      ) : (
                        <span className="twix-muted" style={{ fontSize: 10 }}>
                          Нельзя удалить последний этаж
                        </span>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {sortedFloors.length === 0 ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Нет этажей — добавьте или выберите шаблон на холсте.
              </li>
            ) : null}
          </ul>
          <p className="twix-panelTitle" style={{ fontSize: 11, marginTop: 10 }}>
            Стены (активный этаж)
          </p>
          <ul style={{ margin: '4px 0', paddingLeft: 16, listStyle: 'disc' }}>
            {wallsOnFloor.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color:
                      selection.selectedObjectId === w.id &&
                      selection.selectedObjectType === 'wall'
                        ? 'var(--twix-accent, #2563eb)'
                        : 'inherit',
                    textDecoration: 'underline',
                    fontSize: 11,
                  }}
                  onClick={() => selectObject(w.id, 'wall')}
                >
                  {w.id.slice(0, 8)}… {w.wallType === 'internal' ? '(внутр.)' : ''}{' '}
                  {w.thicknessMm}мм
                </button>
              </li>
            ))}
            {!floorId ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Выберите этаж
              </li>
            ) : wallsOnFloor.length === 0 ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Нет стен
              </li>
            ) : null}
          </ul>
          <p className="twix-panelTitle" style={{ fontSize: 11, marginTop: 10 }}>
            Проёмы (активный этаж)
          </p>
          <ul style={{ margin: '4px 0', paddingLeft: 16, listStyle: 'disc' }}>
            {openingsOnFloor.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color:
                      selection.selectedObjectId === o.id &&
                      selection.selectedObjectType === 'opening'
                        ? 'var(--twix-accent, #2563eb)'
                        : 'inherit',
                    textDecoration: 'underline',
                    fontSize: 11,
                  }}
                  onClick={() => selectObject(o.id, 'opening')}
                >
                  {openingTypeRu(o.openingType)} · стена {wallShort(o.wallId)} · {o.widthMm}×
                  {o.heightMm}
                </button>
              </li>
            ))}
            {!floorId ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Выберите этаж
              </li>
            ) : openingsOnFloor.length === 0 ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Нет проёмов
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </Sidebar>
  );
}
