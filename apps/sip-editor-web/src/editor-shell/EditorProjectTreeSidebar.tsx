import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { getFloorsSorted } from '@2wix/domain-model';
import type { ActivePanel } from '@2wix/editor-core';
import {
  EDITOR_LAYER_FOUNDATION,
  EDITOR_LAYER_GROUND_SCREED,
  EDITOR_LAYER_ROOF,
  EDITOR_LAYER_SLABS,
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerLocked,
  isEditorLayerVisible,
  useEditorStore,
} from '@2wix/editor-core';
import { EditorLeftSidebarBody } from '@/components/EditorLeftSidebar';
import { cad } from './cadTheme';

type TreeKey = string;

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        fontSize: 9,
        color: cad.muted,
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform 0.1s',
      }}
    >
      ▶
    </span>
  );
}

function TreeRow({
  depth,
  label,
  active,
  onClick,
  disabled,
  chevron,
  onChevron,
  open,
  hint,
  eye,
  lock,
}: {
  depth: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  chevron?: boolean;
  onChevron?: () => void;
  open?: boolean;
  hint?: string;
  eye?: React.ReactNode;
  lock?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={hint}
      disabled={Boolean(disabled)}
      onClick={(e) => {
        if (chevron && (e.target as HTMLElement).closest('.cad-tree-chevron')) {
          onChevron?.();
          return;
        }
        if (!disabled) onClick?.();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '3px 4px 3px 4px',
        paddingLeft: 4 + depth * 12,
        marginBottom: 1,
        fontSize: cad.fontSize,
        fontFamily: 'inherit',
        border: `1px solid ${active ? cad.accent : 'transparent'}`,
        borderRadius: cad.btnRadius,
        background: active ? cad.accentSoft : 'transparent',
        color: disabled ? cad.muted : cad.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {chevron ? (
        <span
          className="cad-tree-chevron"
          onClick={(e) => {
            e.stopPropagation();
            onChevron?.();
          }}
          style={{ cursor: 'pointer' }}
        >
          <Chevron open={open ?? false} />
        </span>
      ) : (
        <span style={{ width: 12 }} />
      )}
      <span style={{ marginLeft: 2, flex: 1 }}>{label}</span>
      {eye ? <span style={{ display: 'inline-flex', gap: 2 }}>{eye}</span> : null}
      {lock ? <span style={{ display: 'inline-flex', gap: 2 }}>{lock}</span> : null}
    </button>
  );
}

function IconBtn({
  title,
  pressed,
  onClick,
  children,
}: {
  title: string;
  pressed?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as MouseEvent);
        }
      }}
      style={{
        cursor: 'pointer',
        padding: '0 3px',
        borderRadius: 3,
        fontSize: 11,
        lineHeight: 1,
        border: `1px solid ${pressed ? cad.accent : cad.borderSubtle}`,
        background: pressed ? cad.accentSoft : '#fff',
        color: cad.text,
      }}
    >
      {children}
    </span>
  );
}

export function EditorProjectTreeSidebar() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const view = useEditorStore((s) => s.view);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const setActiveEditorLayer = useEditorStore((s) => s.setActiveEditorLayer);
  const setLayerVisibility = useEditorStore((s) => s.setLayerVisibility);
  const setLayerLocked = useEditorStore((s) => s.setLayerLocked);
  const activeEditorLayerId = view.activeEditorLayerId;
  const selectObject = useEditorStore((s) => s.selectObject);

  const [openMap, setOpenMap] = useState<Partial<Record<TreeKey, boolean>>>({
    plan: true,
    foundation: true,
    slab: false,
    roof: false,
  });

  const floors = useMemo(() => (draft ? getFloorsSorted(draft) : []), [draft]);
  const floorId = view.activeFloorId;

  const toggle = (k: TreeKey) => setOpenMap((m) => ({ ...m, [k]: !m[k] }));

  const go = (panel: ActivePanel) => setActivePanel(panel);

  const vis = (layerKey: string) => isEditorLayerVisible(view.layerVisibility, layerKey);
  const locked = (layerKey: string) => isEditorLayerLocked(view.layerLocked, layerKey);

  return (
    <div>
      <div
        style={{
          fontSize: cad.fontSize,
          fontWeight: 600,
          padding: '4px 2px 6px',
          borderBottom: `1px solid ${cad.borderSubtle}`,
          marginBottom: 6,
          color: cad.text,
        }}
      >
        Структура проекта
      </div>

      <TreeRow
        depth={0}
        label="Фундамент"
        chevron
        open={openMap.foundation}
        onChevron={() => toggle('foundation')}
        active={
          activeEditorLayerId === EDITOR_LAYER_FOUNDATION ||
          activeEditorLayerId === EDITOR_LAYER_GROUND_SCREED
        }
        hint="Ленточный фундамент и стяжка по контуру"
        onClick={() => {
          setActiveEditorLayer(EDITOR_LAYER_FOUNDATION);
          go('floors');
        }}
        eye={
          <IconBtn
            title={vis(EDITOR_LAYER_FOUNDATION) ? 'Скрыть ленту' : 'Показать ленту'}
            pressed={vis(EDITOR_LAYER_FOUNDATION)}
            onClick={() => setLayerVisibility(EDITOR_LAYER_FOUNDATION, !vis(EDITOR_LAYER_FOUNDATION))}
          >
            {vis(EDITOR_LAYER_FOUNDATION) ? '👁' : '◌'}
          </IconBtn>
        }
      />
      {openMap.foundation ? (
        <>
          <TreeRow
            depth={1}
            label="Лента"
            active={activeEditorLayerId === EDITOR_LAYER_FOUNDATION}
            hint="Ленточный фундамент по периметру"
            onClick={() => {
              setActiveEditorLayer(EDITOR_LAYER_FOUNDATION);
              go('floors');
            }}
            eye={
              <IconBtn
                title={vis(EDITOR_LAYER_FOUNDATION) ? 'Скрыть' : 'Показать'}
                pressed={vis(EDITOR_LAYER_FOUNDATION)}
                onClick={() => setLayerVisibility(EDITOR_LAYER_FOUNDATION, !vis(EDITOR_LAYER_FOUNDATION))}
              >
                {vis(EDITOR_LAYER_FOUNDATION) ? '👁' : '◌'}
              </IconBtn>
            }
            lock={
              <IconBtn
                title={locked(EDITOR_LAYER_FOUNDATION) ? 'Разблокировать' : 'Заблокировать'}
                pressed={locked(EDITOR_LAYER_FOUNDATION)}
                onClick={() => setLayerLocked(EDITOR_LAYER_FOUNDATION, !locked(EDITOR_LAYER_FOUNDATION))}
              >
                {locked(EDITOR_LAYER_FOUNDATION) ? '🔒' : '🔓'}
              </IconBtn>
            }
          />
          <TreeRow
            depth={1}
            label="Стяжка"
            active={activeEditorLayerId === EDITOR_LAYER_GROUND_SCREED}
            hint="Плита / стяжка внутри контура"
            onClick={() => {
              setActiveEditorLayer(EDITOR_LAYER_GROUND_SCREED);
              go('floors');
            }}
            eye={
              <IconBtn
                title={vis(EDITOR_LAYER_GROUND_SCREED) ? 'Скрыть' : 'Показать'}
                pressed={vis(EDITOR_LAYER_GROUND_SCREED)}
                onClick={() => setLayerVisibility(EDITOR_LAYER_GROUND_SCREED, !vis(EDITOR_LAYER_GROUND_SCREED))}
              >
                {vis(EDITOR_LAYER_GROUND_SCREED) ? '👁' : '◌'}
              </IconBtn>
            }
            lock={
              <IconBtn
                title={locked(EDITOR_LAYER_GROUND_SCREED) ? 'Разблокировать' : 'Заблокировать'}
                pressed={locked(EDITOR_LAYER_GROUND_SCREED)}
                onClick={() => setLayerLocked(EDITOR_LAYER_GROUND_SCREED, !locked(EDITOR_LAYER_GROUND_SCREED))}
              >
                {locked(EDITOR_LAYER_GROUND_SCREED) ? '🔒' : '🔓'}
              </IconBtn>
            }
          />
        </>
      ) : null}

      <TreeRow
        depth={0}
        label="План этажа"
        chevron
        open={openMap.plan}
        onChevron={() => toggle('plan')}
        active={
          view.activePanel === 'floors' &&
          activeEditorLayerId !== EDITOR_LAYER_FOUNDATION &&
          activeEditorLayerId !== EDITOR_LAYER_GROUND_SCREED
        }
        onClick={() => go('floors')}
      />
      {openMap.plan
        ? floors.map((f) => {
            const wKey = editorLayerFloorWalls(f.id);
            const oKey = editorLayerFloorOpenings(f.id);
            const subOpen = openMap[`floor:${f.id}`] !== false;
            return (
              <div key={f.id}>
                <TreeRow
                  depth={1}
                  label={f.label}
                  chevron
                  open={subOpen}
                  onChevron={() => toggle(`floor:${f.id}`)}
                  active={floorId === f.id && activeEditorLayerId !== wKey && activeEditorLayerId !== oKey}
                  hint="Этаж (свойства)"
                  onClick={() => {
                    setActiveFloor(f.id);
                    selectObject(f.id, 'floor');
                    go('floors');
                  }}
                />
                {subOpen ? (
                  <>
                    <TreeRow
                      depth={2}
                      label={`Стены — ${f.label}`}
                      active={activeEditorLayerId === wKey}
                      hint="Рисование и редактирование стен"
                      onClick={() => {
                        setActiveEditorLayer(wKey);
                        setActiveFloor(f.id);
                        go('floors');
                      }}
                      eye={
                        <IconBtn
                          title={vis(wKey) ? 'Скрыть стены' : 'Показать стены'}
                          pressed={vis(wKey)}
                          onClick={() => setLayerVisibility(wKey, !vis(wKey))}
                        >
                          {vis(wKey) ? '👁' : '◌'}
                        </IconBtn>
                      }
                      lock={
                        <IconBtn
                          title={locked(wKey) ? 'Разблокировать' : 'Заблокировать'}
                          pressed={locked(wKey)}
                          onClick={() => setLayerLocked(wKey, !locked(wKey))}
                        >
                          {locked(wKey) ? '🔒' : '🔓'}
                        </IconBtn>
                      }
                    />
                    <TreeRow
                      depth={2}
                      label={`Проёмы — ${f.label}`}
                      active={activeEditorLayerId === oKey}
                      hint="Окна, двери, проёмы"
                      onClick={() => {
                        setActiveEditorLayer(oKey);
                        setActiveFloor(f.id);
                        go('floors');
                      }}
                      eye={
                        <IconBtn
                          title={vis(oKey) ? 'Скрыть проёмы' : 'Показать проёмы'}
                          pressed={vis(oKey)}
                          onClick={() => setLayerVisibility(oKey, !vis(oKey))}
                        >
                          {vis(oKey) ? '👁' : '◌'}
                        </IconBtn>
                      }
                      lock={
                        <IconBtn
                          title={locked(oKey) ? 'Разблокировать' : 'Заблокировать'}
                          pressed={locked(oKey)}
                          onClick={() => setLayerLocked(oKey, !locked(oKey))}
                        >
                          {locked(oKey) ? '🔒' : '🔓'}
                        </IconBtn>
                      }
                    />
                  </>
                ) : null}
              </div>
            );
          })
        : null}

      <TreeRow
        depth={0}
        label="Перекрытие"
        chevron
        open={openMap.slab}
        onChevron={() => toggle('slab')}
        active={activeEditorLayerId === EDITOR_LAYER_SLABS || view.activePanel === 'slabs'}
        hint="Плиты перекрытия"
        onClick={() => {
          setActiveEditorLayer(EDITOR_LAYER_SLABS);
          go('slabs');
        }}
        eye={
          <IconBtn
            title={vis(EDITOR_LAYER_SLABS) ? 'Скрыть' : 'Показать'}
            pressed={vis(EDITOR_LAYER_SLABS)}
            onClick={() => setLayerVisibility(EDITOR_LAYER_SLABS, !vis(EDITOR_LAYER_SLABS))}
          >
            {vis(EDITOR_LAYER_SLABS) ? '👁' : '◌'}
          </IconBtn>
        }
        lock={
          <IconBtn
            title={locked(EDITOR_LAYER_SLABS) ? 'Разблокировать' : 'Заблокировать'}
            pressed={locked(EDITOR_LAYER_SLABS)}
            onClick={() => setLayerLocked(EDITOR_LAYER_SLABS, !locked(EDITOR_LAYER_SLABS))}
          >
            {locked(EDITOR_LAYER_SLABS) ? '🔒' : '🔓'}
          </IconBtn>
        }
      />

      <TreeRow
        depth={0}
        label="Крыша"
        chevron
        open={openMap.roof}
        onChevron={() => toggle('roof')}
        active={activeEditorLayerId === EDITOR_LAYER_ROOF || view.activePanel === 'roof'}
        hint="Кровля"
        onClick={() => {
          setActiveEditorLayer(EDITOR_LAYER_ROOF);
          go('roof');
        }}
        eye={
          <IconBtn
            title={vis(EDITOR_LAYER_ROOF) ? 'Скрыть' : 'Показать'}
            pressed={vis(EDITOR_LAYER_ROOF)}
            onClick={() => setLayerVisibility(EDITOR_LAYER_ROOF, !vis(EDITOR_LAYER_ROOF))}
          >
            {vis(EDITOR_LAYER_ROOF) ? '👁' : '◌'}
          </IconBtn>
        }
        lock={
          <IconBtn
            title={locked(EDITOR_LAYER_ROOF) ? 'Разблокировать' : 'Заблокировать'}
            pressed={locked(EDITOR_LAYER_ROOF)}
            onClick={() => setLayerLocked(EDITOR_LAYER_ROOF, !locked(EDITOR_LAYER_ROOF))}
          >
            {locked(EDITOR_LAYER_ROOF) ? '🔒' : '🔓'}
          </IconBtn>
        }
      />

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${cad.borderSubtle}`,
        }}
      >
        <EditorLeftSidebarBody />
      </div>
    </div>
  );
}
