import type { BuildingModel, WallPlacementMode, WallType } from '@2wix/shared-types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';

/** Тип объекта в сцене редактора (выделение / hover). */
export type EditorObjectType =
  | 'wall'
  | 'opening'
  | 'slab'
  | 'roof'
  | 'floor'
  | 'foundation'
  | 'groundScreed';

export interface EditorDocumentState {
  projectId: string | null;
  projectTitle: string | null;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  serverModel: BuildingModel | null;
  draftModel: BuildingModel | null;
  schemaVersion: number | null;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  lastError: string | null;
  hasUnsavedChanges: boolean;
}

export interface SelectionState {
  selectedObjectId: string | null;
  selectedObjectType: EditorObjectType | null;
  hoveredObjectId: string | null;
  hoveredObjectType: EditorObjectType | null;
  multiSelectIds: string[];
}

export type ActivePanel =
  | 'project'
  | 'floors'
  | 'walls'
  | 'openings'
  | 'sip'
  | 'spec'
  | 'exports'
  | 'roof'
  | 'slabs'
  | 'versions';

/** Режим инструмента на 2D-canvas (не попадает в undo/redo). */
export type CanvasToolMode =
  | 'select'
  | 'pan'
  | 'draw-wall'
  | 'draw-rectangle'
  | 'draw-window'
  | 'draw-door'
  | 'draw-portal';

export interface ViewState {
  activeFloorId: string | null;
  /** Активный «слой» дерева проекта (напр. floor-walls:uuid). */
  activeEditorLayerId: string | null;
  activePanel: ActivePanel;
  toolMode: CanvasToolMode;
  /** Видимость разделов/подразделов: ключ — id слоя (см. editorLayers), по умолчанию видимо. */
  layerVisibility: Record<string, boolean>;
  /** Блокировка слоя: только просмотр, без правок на canvas. */
  layerLocked: Record<string, boolean>;
  /** Тип стены для инструментов «Стена» и «Прямоугольник» (не сериализуется отдельно — только UX). */
  newWallWallType: WallType;
  /** Режим привязки толщины к базовой линии при новых стенах (UI, не сервер). */
  newWallPlacement: WallPlacementMode;
  zoom: number;
  panX: number;
  panY: number;
  snapEnabled: boolean;
  gridVisible: boolean;
}

export interface HistoryState {
  past: BuildingModel[];
  future: BuildingModel[];
  limit: number;
}

export interface EditorState {
  document: EditorDocumentState;
  selection: SelectionState;
  view: ViewState;
  history: HistoryState;
}

export const DEFAULT_HISTORY_LIMIT = 50;

/** @deprecated Используйте ActivePanel — оставлено для постепенной миграции импортов. */
export type EditorSidebarSection = Exclude<ActivePanel, 'project'>;
