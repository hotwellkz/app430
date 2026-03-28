import type { CSSProperties } from 'react';
import { clampEditorZoom, useEditorStore } from '@2wix/editor-core';
import type { CanvasToolMode } from '@2wix/editor-core';
import { canDeleteSelectedSpatial, isWallSelected } from '@/canvas2d/selectionGuards';

const btn: CSSProperties = {
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '5px 11px',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 7,
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  cursor: 'pointer',
  color: '#1d1d1f',
  fontWeight: 400,
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  transition: 'background 0.1s, box-shadow 0.1s',
};

const btnActive: CSSProperties = {
  ...btn,
  background: '#007aff',
  borderColor: 'transparent',
  color: '#fff',
  fontWeight: 590,
  boxShadow: '0 1px 4px rgba(0,122,255,0.35)',
};

interface EditorToolbarProps {
  statusBadge: string;
  onSave: () => void;
  onNewVersion: () => void;
  savePending: boolean;
  newVersionPending: boolean;
  onFitView?: () => void;
  /** MVP: мастер AI-импорта по фото/планам (кнопка всегда видима) */
  onOpenAiImport?: () => void;
}

function toolLabel(m: CanvasToolMode): string {
  switch (m) {
    case 'select':
      return 'Выбор';
    case 'pan':
      return 'Панорама';
    case 'draw-wall':
      return 'Стена';
    case 'draw-window':
      return 'Окно';
    case 'draw-door':
      return 'Дверь';
    case 'draw-portal':
      return 'Портал';
    default:
      return m;
  }
}

const TOOL_MODES: CanvasToolMode[] = [
  'select',
  'pan',
  'draw-wall',
  'draw-window',
  'draw-door',
  'draw-portal',
];

export function EditorToolbar({
  statusBadge,
  onSave,
  onNewVersion,
  savePending,
  newVersionPending,
  onFitView,
  onOpenAiImport,
}: EditorToolbarProps) {
  const document = useEditorStore((s) => s.document);
  const view = useEditorStore((s) => s.view);
  const selection = useEditorStore((s) => s.selection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const discardDraft = useEditorStore((s) => s.discardDraft);
  const setToolMode = useEditorStore((s) => s.setToolMode);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const applyCommand = useEditorStore((s) => s.applyCommand);

  const wallSelected = isWallSelected(selection);
  const canSpatialDelete = canDeleteSelectedSpatial(selection);
  const canOpenAiImport = typeof onOpenAiImport === 'function';

  const setMode = (mode: CanvasToolMode) => setToolMode(mode);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '7px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      <span
        title={document.lastError ?? undefined}
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 5,
          background: document.hasUnsavedChanges
            ? 'rgba(255,196,0,0.18)'
            : 'rgba(52,199,89,0.15)',
          color: document.hasUnsavedChanges ? '#b45309' : '#166534',
        }}
      >
        {statusBadge}
      </span>
      {document.hasUnsavedChanges ? (
        <span style={{ fontSize: 11, color: '#8e8e93' }}>● черновик</span>
      ) : (
        <span style={{ fontSize: 11, color: '#8e8e93' }}>○ сохранено</span>
      )}

      <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

      {TOOL_MODES.map((m) => (
        <button
          key={m}
          type="button"
          style={view.toolMode === m ? btnActive : btn}
          onClick={() => setMode(m)}
        >
          {toolLabel(m)}
        </button>
      ))}

      <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

      <button type="button" style={btn} disabled={!canUndo()} onClick={() => undo()}>
        Undo
      </button>
      <button type="button" style={btn} disabled={!canRedo()} onClick={() => redo()}>
        Redo
      </button>
      <button
        type="button"
        style={btn}
        disabled={!document.hasUnsavedChanges}
        onClick={() => discardDraft()}
      >
        Сбросить
      </button>
      <button type="button" style={btn} disabled={savePending || newVersionPending} onClick={onSave}>
        Сохранить
      </button>
      <button
        type="button"
        style={btn}
        disabled={newVersionPending || savePending}
        onClick={onNewVersion}
      >
        Новая версия
      </button>

      <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
      <button
        type="button"
        style={{
          ...btn,
          background: '#007aff',
          borderColor: 'transparent',
          color: '#fff',
          fontWeight: 590,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,122,255,0.4)',
        }}
        disabled={savePending || newVersionPending || !canOpenAiImport}
        onClick={() => onOpenAiImport?.()}
        title={
          canOpenAiImport
            ? 'Загрузить планы/фасады и создать import-job'
            : 'AI-импорт недоступен в текущем экране'
        }
        data-testid="editor-toolbar-ai-import"
      >
        Импорт по фото/планам
      </button>

      <button
        type="button"
        style={btn}
        disabled={!canSpatialDelete}
        onClick={() => {
          if (selection.selectedObjectType === 'wall' && selection.selectedObjectId) {
            applyCommand({ type: 'deleteWall', wallId: selection.selectedObjectId });
          } else if (selection.selectedObjectType === 'opening' && selection.selectedObjectId) {
            applyCommand({ type: 'deleteOpening', openingId: selection.selectedObjectId });
          }
        }}
      >
        Удалить выбранное
      </button>

      <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

      <button type="button" style={btn} onClick={() => onFitView?.()} disabled={!onFitView}>
        Вписать вид
      </button>

      <button
        type="button"
        style={btn}
        onClick={() => setZoom(clampEditorZoom(view.zoom * 1.15))}
      >
        Zoom +
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => setZoom(clampEditorZoom(view.zoom / 1.15))}
      >
        Zoom −
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => {
          setZoom(1);
          setPan(0, 0);
        }}
      >
        Сброс вида
      </button>

      <button
        type="button"
        style={view.gridVisible ? btnActive : btn}
        onClick={() => toggleGrid()}
      >
        Сетка
      </button>
      <button
        type="button"
        style={view.snapEnabled ? btnActive : btn}
        onClick={() => toggleSnap()}
      >
        Привязка
      </button>

      <span style={{ fontSize: 10.5, color: '#8e8e93', marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
        z {view.zoom.toFixed(2)} · pan {view.panX.toFixed(0)},{view.panY.toFixed(0)} · инструмент:{' '}
        {view.toolMode}
        {wallSelected ? ' · ручки стены' : ''}
      </span>
    </div>
  );
}
