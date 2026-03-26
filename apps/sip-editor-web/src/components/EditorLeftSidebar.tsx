import { createFloor, getOpeningsByFloor, getWallsByFloor } from '@2wix/domain-model';
import type { ActivePanel } from '@2wix/editor-core';
import { useEditorStore } from '@2wix/editor-core';
import { Sidebar, SidebarNavButton } from '@2wix/ui-kit';

const SECTIONS: { id: ActivePanel; label: string }[] = [
  { id: 'project', label: 'Проект' },
  { id: 'floors', label: 'Этажи' },
  { id: 'walls', label: 'Стены' },
  { id: 'openings', label: 'Проёмы' },
  { id: 'roof', label: 'Кровля' },
  { id: 'slabs', label: 'Плиты' },
  { id: 'versions', label: 'Версии' },
];

export function EditorLeftSidebar() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const view = useEditorStore((s) => s.view);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const selectObject = useEditorStore((s) => s.selectObject);

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
    const f = createFloor({
      label: `Этаж ${draft.floors.length + 1}`,
      sortIndex: draft.floors.length,
    });
    applyCommand({ type: 'addFloor', floor: f });
    setActiveFloor(f.id);
  };

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
            maxHeight: '40vh',
            overflow: 'auto',
          }}
        >
          <p className="twix-panelTitle" style={{ fontSize: 11 }}>
            Этажи
          </p>
          <button type="button" style={{ fontSize: 11, marginBottom: 8 }} onClick={addFloor}>
            + Этаж
          </button>
          <ul style={{ margin: '4px 0', paddingLeft: 16, listStyle: 'disc' }}>
            {draft.floors.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color:
                      floorId === f.id ? 'var(--twix-accent, #2563eb)' : 'inherit',
                    textDecoration: 'underline',
                    fontSize: 12,
                  }}
                  onClick={() => {
                    setActiveFloor(f.id);
                    selectObject(f.id, 'floor');
                  }}
                >
                  {f.label}
                </button>
              </li>
            ))}
            {draft.floors.length === 0 ? (
              <li className="twix-muted" style={{ fontSize: 11 }}>
                Нет этажей
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
                  {openingTypeRu(o.openingType)} · стена {wallShort(o.wallId)} · {o.widthMm}×{o.heightMm}
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
