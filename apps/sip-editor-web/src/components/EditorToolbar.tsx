import type { CSSProperties } from 'react';
import { clampEditorZoom, useEditorStore } from '@2wix/editor-core';
import type { CanvasToolMode } from '@2wix/editor-core';
import { canDeleteSelectedSpatial, isWallSelected } from '@/canvas2d/selectionGuards';

const btn: CSSProperties = {
  fontSize: 12,
  padding: '6px 10px',
  border: '1px solid var(--twix-border, #e2e8f0)',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
};

const btnActive: CSSProperties = {
  ...btn,
  background: '#dbeafe',
  borderColor: '#3b82f6',
};

interface EditorToolbarProps {
  statusBadge: string;
  onSave: () => void;
  onNewVersion: () => void;
  savePending: boolean;
  newVersionPending: boolean;
  onFitView?: () => void;
  /** MVP: мастер AI-импорта по фото/планам */
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

  const setMode = (mode: CanvasToolMode) => setToolMode(mode);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--twix-border, #e2e8f0)',
        background: '#fafafa',
      }}
    >
      <span
        title={document.lastError ?? undefined}
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          background: document.hasUnsavedChanges ? '#fef3c7' : '#ecfdf5',
        }}
      >
        {statusBadge}
      </span>
      {document.hasUnsavedChanges ? (
        <span style={{ fontSize: 11, color: '#64748b' }}>● черновик</span>
      ) : (
        <span style={{ fontSize: 11, color: '#64748b' }}>○ сохранено</span>
      )}

      <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

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

      <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

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

      {onOpenAiImport ? (
        <>
          <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
          <button
            type="button"
            style={{
              ...btn,
              fontWeight: 600,
              borderColor: '#6366f1',
              color: '#4338ca',
            }}
            disabled={savePending || newVersionPending}
            onClick={onOpenAiImport}
            title="Загрузить планы/фасады и создать import-job"
            data-testid="editor-toolbar-ai-import"
          >
            Импорт по фото/планам
          </button>
        </>
      ) : null}

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

      <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

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

      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
        z {view.zoom.toFixed(2)} · pan {view.panX.toFixed(0)},{view.panY.toFixed(0)} · инструмент:{' '}
        {view.toolMode}
        {wallSelected ? ' · ручки стены' : ''}
      </span>
    </div>
  );
}
