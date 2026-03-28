import type { CSSProperties, ReactNode } from 'react';
import {
  clampEditorZoom,
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerLocked,
  isEditorLayerVisible,
  isFloorOpeningsLayer,
  isWallDrawingLayer,
  parseFloorOpeningsLayer,
  parseFloorWallsLayer,
  useEditorStore,
} from '@2wix/editor-core';
import type { WallPlacementMode } from '@2wix/shared-types';
import type { CanvasToolMode } from '@2wix/editor-core';
import { canDeleteSelectedSpatial, isWallSelected } from '@/canvas2d/selectionGuards';
import { cad } from './cadTheme';
import {
  IcoCursor,
  IcoDoor,
  IcoFit,
  IcoFolderOpen,
  IcoGrid,
  IcoHand,
  IcoImport,
  IcoLine,
  IcoMagnet,
  IcoPortal,
  IcoRect,
  IcoRedo,
  IcoReset,
  IcoSave,
  IcoUndo,
  IcoVersion,
  IcoWindow,
  IcoZoomIn,
  IcoZoomOut,
} from './CadSmallIcons';

export interface EditorToolbarProps {
  statusBadge: string;
  onSave: () => void;
  onNewVersion: () => void;
  savePending: boolean;
  newVersionPending: boolean;
  /** Копия проекта на сервере (новый projectId). */
  onSaveAs?: () => void;
  saveAsPending?: boolean;
  onFitView?: () => void;
  /** MVP: мастер AI-импорта по фото/планам (кнопка всегда видима) */
  onOpenAiImport?: () => void;
}

export interface EditorTopToolbarProps extends EditorToolbarProps {
  viewMode?: '2d' | '3d';
  onViewModeChange?: (m: '2d' | '3d') => void;
  /** Открыть файл — пока заглушка */
  onOpenFile?: () => void;
}

function toolLabel(m: CanvasToolMode): string {
  switch (m) {
    case 'select':
      return 'Выбор';
    case 'pan':
      return 'Панорама';
    case 'draw-wall':
      return 'Стена';
    case 'draw-rectangle':
      return 'Прямоугольник';
    case 'draw-window':
      return 'Окно';
    case 'draw-door':
      return 'Дверь';
    case 'draw-portal':
      return 'Проём';
    default:
      return m;
  }
}

const TOOL_MODES: { mode: CanvasToolMode; icon: ReactNode; title: string }[] = [
  { mode: 'select', icon: <IcoCursor />, title: 'Выделение' },
  { mode: 'pan', icon: <IcoHand />, title: 'Панорама' },
  { mode: 'draw-wall', icon: <IcoLine />, title: 'Стена' },
  { mode: 'draw-rectangle', icon: <IcoRect />, title: 'Прямоугольник' },
  { mode: 'draw-window', icon: <IcoWindow />, title: 'Окно' },
  { mode: 'draw-door', icon: <IcoDoor />, title: 'Дверь' },
  { mode: 'draw-portal', icon: <IcoPortal />, title: 'Проём' },
];

function Vsep() {
  return (
    <span
      style={{
        width: 1,
        height: 18,
        background: cad.borderSubtle,
        margin: '0 3px',
        flexShrink: 0,
      }}
    />
  );
}

function TBtn({
  active,
  disabled,
  title,
  onClick,
  children,
  wide,
  'data-testid': dataTestId,
}: {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
  wide?: boolean;
  'data-testid'?: string;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: wide ? undefined : 26,
    height: 24,
    padding: wide ? '0 8px' : '0 4px',
    border: `1px solid ${active ? cad.accent : cad.borderSubtle}`,
    borderRadius: cad.btnRadius,
    background: active ? cad.accentSoft : '#f4f5f7',
    color: cad.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.42 : 1,
    fontSize: cad.fontSize,
    fontFamily: 'inherit',
  };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={base} data-testid={dataTestId}>
      {children}
    </button>
  );
}

export function EditorTopToolbar({
  statusBadge,
  onSave,
  onNewVersion,
  savePending,
  newVersionPending,
  onSaveAs,
  saveAsPending,
  onFitView,
  onOpenAiImport,
  viewMode = '2d',
  onViewModeChange,
  onOpenFile,
}: EditorTopToolbarProps) {
  const document = useEditorStore((s) => s.document);
  const view = useEditorStore((s) => s.view);
  const selection = useEditorStore((s) => s.selection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const discardDraft = useEditorStore((s) => s.discardDraft);
  const setToolMode = useEditorStore((s) => s.setToolMode);
  const newWallWallType = useEditorStore((s) => s.view.newWallWallType ?? 'external');
  const setNewWallWallType = useEditorStore((s) => s.setNewWallWallType);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setNewWallPlacement = useEditorStore((s) => s.setNewWallPlacement);

  const activeFloorId = view.activeFloorId;
  const activeEditorLayerId = view.activeEditorLayerId ?? null;
  const wallLayerFloorId = parseFloorWallsLayer(activeEditorLayerId);
  const wallLayerKey = activeFloorId ? editorLayerFloorWalls(activeFloorId) : '';
  const openLayerKey = activeFloorId ? editorLayerFloorOpenings(activeFloorId) : '';
  const canDrawWalls =
    Boolean(activeFloorId) &&
    isWallDrawingLayer(activeEditorLayerId) &&
    wallLayerFloorId === activeFloorId &&
    isEditorLayerVisible(view.layerVisibility, wallLayerKey) &&
    !isEditorLayerLocked(view.layerLocked, wallLayerKey);
  const canPlaceOpenings =
    Boolean(activeFloorId) &&
    isFloorOpeningsLayer(activeEditorLayerId) &&
    parseFloorOpeningsLayer(activeEditorLayerId) === activeFloorId &&
    isEditorLayerVisible(view.layerVisibility, openLayerKey) &&
    !isEditorLayerLocked(view.layerLocked, openLayerKey);
  const newWallPlacement = view.newWallPlacement ?? 'on-axis';

  const wallSelected = isWallSelected(selection);
  const canSpatialDelete = canDeleteSelectedSpatial(selection);
  const canOpenAiImport = typeof onOpenAiImport === 'function';
  const openFileDisabled = typeof onOpenFile !== 'function';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: cad.toolbarBg,
        minHeight: 30,
      }}
    >
      <span
        title={document.lastError ?? undefined}
        style={{
          fontSize: cad.fontSizeSm,
          padding: '1px 6px',
          borderRadius: cad.btnRadius,
          border: `1px solid ${cad.borderSubtle}`,
          background: document.hasUnsavedChanges ? '#fff4e0' : '#e8f5e9',
          color: document.hasUnsavedChanges ? '#8a5a00' : '#1b5e20',
          flexShrink: 0,
        }}
      >
        {statusBadge}
      </span>
      <span style={{ fontSize: cad.fontSizeSm, color: cad.muted, flexShrink: 0 }}>
        {document.hasUnsavedChanges ? '● черновик' : '○ сохранено'}
      </span>

      <Vsep />

      <TBtn
        title={openFileDisabled ? 'Открыть (скоро)' : 'Открыть'}
        disabled={openFileDisabled}
        onClick={() => onOpenFile?.()}
      >
        <IcoFolderOpen />
      </TBtn>
      <TBtn
        title="Сохранить"
        disabled={savePending || newVersionPending || saveAsPending}
        onClick={onSave}
      >
        <IcoSave />
      </TBtn>
      {typeof onSaveAs === 'function' ? (
        <TBtn
          wide
          title="Сохранить как новый проект (копия текущей версии на сервере)"
          disabled={Boolean(saveAsPending) || savePending || newVersionPending}
          onClick={onSaveAs}
        >
          Сохранить как
        </TBtn>
      ) : null}

      <Vsep />

      <TBtn title="Сетка" active={view.gridVisible} onClick={() => toggleGrid()}>
        <IcoGrid />
      </TBtn>
      <TBtn title="Привязка" active={view.snapEnabled} onClick={() => toggleSnap()}>
        <IcoMagnet />
      </TBtn>

      <Vsep />

      {TOOL_MODES.map(({ mode, icon, title }) => {
        const isOpeningTool =
          mode === 'draw-window' || mode === 'draw-door' || mode === 'draw-portal';
        const wallLayerBlocked =
          (mode === 'draw-wall' || mode === 'draw-rectangle') && !canDrawWalls;
        const openingBlocked = isOpeningTool && !canPlaceOpenings;
        const disabled = wallLayerBlocked || openingBlocked;
        let hintTitle = `${title} (${toolLabel(mode)})`;
        if (wallLayerBlocked) {
          hintTitle = `${title} — активируйте слой «Стены» этажа (структура слева), слой видим и не заблокирован`;
        } else if (openingBlocked) {
          hintTitle = `${title} — активируйте слой «Проёмы» этажа; слой видим и не заблокирован`;
        }
        return (
          <TBtn
            key={mode}
            title={hintTitle}
            active={view.toolMode === mode}
            disabled={disabled}
            onClick={() => setToolMode(mode)}
          >
            {icon}
          </TBtn>
        );
      })}

      <label
        style={{
          fontSize: cad.fontSizeSm,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: cad.muted,
          marginLeft: 2,
        }}
      >
        стена
        <select
          value={newWallWallType}
          onChange={(e) => setNewWallWallType(e.target.value as 'external' | 'internal')}
          style={{
            fontSize: cad.fontSize,
            padding: '1px 4px',
            borderRadius: cad.btnRadius,
            border: `1px solid ${cad.borderSubtle}`,
            background: '#fff',
          }}
        >
          <option value="external">наружн.</option>
          <option value="internal">внутр.</option>
        </select>
      </label>

      <label
        style={{
          fontSize: cad.fontSizeSm,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: cad.muted,
          marginLeft: 2,
        }}
      >
        линия
        <select
          value={newWallPlacement}
          onChange={(e) => setNewWallPlacement(e.target.value as WallPlacementMode)}
          title="Как толщина стены позиционируется относительно нарисованной линии"
          style={{
            fontSize: cad.fontSize,
            padding: '1px 4px',
            borderRadius: cad.btnRadius,
            border: `1px solid ${cad.borderSubtle}`,
            background: '#fff',
          }}
        >
          <option value="on-axis">По оси</option>
          <option value="inside">Внутрь</option>
          <option value="outside">Наружу</option>
        </select>
      </label>

      <Vsep />

      <TBtn title="Отменить" disabled={!canUndo()} onClick={() => undo()}>
        <IcoUndo />
      </TBtn>
      <TBtn title="Повторить" disabled={!canRedo()} onClick={() => redo()}>
        <IcoRedo />
      </TBtn>
      <TBtn
        title="Сбросить черновик"
        disabled={!document.hasUnsavedChanges}
        onClick={() => discardDraft()}
        wide
      >
        Сброс
      </TBtn>

      <Vsep />

      <TBtn title="Вписать вид" disabled={!onFitView} onClick={() => onFitView?.()}>
        <IcoFit />
      </TBtn>
      <TBtn title="Zoom +" onClick={() => setZoom(clampEditorZoom(view.zoom * 1.15))}>
        <IcoZoomIn />
      </TBtn>
      <TBtn title="Zoom −" onClick={() => setZoom(clampEditorZoom(view.zoom / 1.15))}>
        <IcoZoomOut />
      </TBtn>
      <TBtn
        title="Сброс вида (масштаб и панорама)"
        onClick={() => {
          setZoom(1);
          setPan(0, 0);
        }}
      >
        <IcoReset />
      </TBtn>

      <TBtn
        wide
        title="Пересчитать стыки концов стен (после ручного построения)"
        onClick={() => applyCommand({ type: 'recomputeManualGeometry' })}
      >
        Пересчёт
      </TBtn>

      <Vsep />

      <TBtn
        title="2D"
        active={viewMode === '2d'}
        onClick={() => onViewModeChange?.('2d')}
        disabled={!onViewModeChange}
      >
        2D
      </TBtn>
      <TBtn
        title="3D"
        active={viewMode === '3d'}
        onClick={() => onViewModeChange?.('3d')}
        disabled={!onViewModeChange}
      >
        3D
      </TBtn>

      <Vsep />

      <TBtn
        title="Новая версия на сервере"
        disabled={newVersionPending || savePending}
        onClick={onNewVersion}
      >
        <IcoVersion />
      </TBtn>
      <TBtn
        wide
        title={
          canOpenAiImport
            ? 'Импорт по фото/планам'
            : 'AI-импорт недоступен в текущем экране'
        }
        disabled={savePending || newVersionPending || !canOpenAiImport}
        onClick={() => onOpenAiImport?.()}
        data-testid="editor-toolbar-ai-import"
      >
        <IcoImport />
        <span style={{ marginLeft: 2 }}>Импорт</span>
      </TBtn>

      <Vsep />

      <TBtn
        title="Удалить выбранное (стена/проём)"
        disabled={!canSpatialDelete}
        wide
        onClick={() => {
          if (selection.selectedObjectType === 'wall' && selection.selectedObjectId) {
            applyCommand({ type: 'deleteWall', wallId: selection.selectedObjectId });
          } else if (selection.selectedObjectType === 'opening' && selection.selectedObjectId) {
            applyCommand({ type: 'deleteOpening', openingId: selection.selectedObjectId });
          }
        }}
      >
        Удалить
      </TBtn>

      <span
        style={{
          fontSize: 10,
          color: cad.muted,
          marginLeft: 6,
          fontVariantNumeric: 'tabular-nums',
          flex: '1 1 120px',
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={`z ${view.zoom.toFixed(2)} · pan ${view.panX.toFixed(0)},${view.panY.toFixed(0)} · ${
          view.toolMode
        }${wallSelected ? ' · ручки стены' : ''}`}
      >
        z {view.zoom.toFixed(2)} · {view.toolMode}
        {wallSelected ? ' ·wall' : ''}
      </span>
    </div>
  );
}
