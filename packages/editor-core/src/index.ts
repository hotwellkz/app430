export type { EditorCommand } from './commands/editorCommands.js';
export {
  isHistoryResetCommand,
  isModelMutationCommand,
} from './commands/editorCommands.js';
export { recomputeDocumentAfterDraftChange } from './pure/documentDraft.js';
export { reduceCommand, executeCommand } from './pure/reduceCommand.js';
export type { ReduceCommandResult } from './pure/reduceCommand.js';
export { pruneSelectionForModel } from './pure/selectionPrune.js';
export { createInitialEditorState, useEditorStore } from './store/editorStore.js';
export type { EditorStore, EditorStoreActions } from './store/editorStore.js';
export {
  clampActiveFloorToModel,
  clampEditorZoom,
  EDITOR_VIEW_MAX_ZOOM,
  EDITOR_VIEW_MIN_ZOOM,
} from './pure/viewClamp.js';
export type {
  ActivePanel,
  CanvasToolMode,
  EditorDocumentState,
  EditorObjectType,
  EditorSidebarSection,
  EditorState,
  HistoryState,
  SaveStatus,
  SelectionState,
  ViewState,
} from './types/state.js';
export { DEFAULT_HISTORY_LIMIT } from './types/state.js';
export {
  DEFAULT_NEW_WALL_PLACEMENT,
  EDITOR_LAYER_FOUNDATION,
  EDITOR_LAYER_GROUND_SCREED,
  EDITOR_LAYER_ROOF,
  EDITOR_LAYER_SLABS,
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerLocked,
  isEditorLayerVisible,
  isFloorOpeningsLayer,
  isFloorPlanEditorLayer,
  isStructuralEditorLayer,
  isWallDrawingLayer,
  parseFloorIdFromEditorLayer,
  parseFloorOpeningsLayer,
  parseFloorWallsLayer,
} from './editorLayers.js';
