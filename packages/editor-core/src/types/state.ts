import type { BuildingModel } from '@2wix/shared-types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';

/** Тип объекта в сцене редактора (выделение / hover). */
export type EditorObjectType = 'wall' | 'opening' | 'slab' | 'roof' | 'floor';

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
  | 'roof'
  | 'slabs'
  | 'versions';

/** Режим инструмента на 2D-canvas (не попадает в undo/redo). */
export type CanvasToolMode =
  | 'select'
  | 'pan'
  | 'draw-wall'
  | 'draw-window'
  | 'draw-door'
  | 'draw-portal';

export interface ViewState {
  activeFloorId: string | null;
  activePanel: ActivePanel;
  toolMode: CanvasToolMode;
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
