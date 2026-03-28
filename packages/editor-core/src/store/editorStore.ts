import { create } from 'zustand';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  cloneBuildingModel,
  getFloorsSorted,
  syncBuildingModelMeta,
  syncFoundationStaleFromSignatures,
  syncRoofStaleFromSignatures,
  syncSlabStaleFromSignatures,
} from '@2wix/domain-model';
import { editorLayerFloorWalls } from '../editorLayers.js';
import type { EditorCommand } from '../commands/editorCommands.js';
import { recomputeDocumentAfterDraftChange } from '../pure/documentDraft.js';
import { reduceCommand } from '../pure/reduceCommand.js';
import { pruneSelectionForModel } from '../pure/selectionPrune.js';
import { clampActiveFloorToModel } from '../pure/viewClamp.js';
import type { ActivePanel, CanvasToolMode, EditorObjectType, EditorState } from '../types/state.js';
import { DEFAULT_HISTORY_LIMIT } from '../types/state.js';

export function createInitialEditorState(): EditorState {
  return {
    document: {
      projectId: null,
      projectTitle: null,
      currentVersionId: null,
      currentVersionNumber: null,
      serverModel: null,
      draftModel: null,
      schemaVersion: null,
      saveStatus: 'idle',
      lastSavedAt: null,
      lastError: null,
      hasUnsavedChanges: false,
    },
    selection: {
      selectedObjectId: null,
      selectedObjectType: null,
      hoveredObjectId: null,
      hoveredObjectType: null,
      multiSelectIds: [],
    },
    view: {
      activeFloorId: null,
      activeEditorLayerId: null,
      activePanel: 'floors',
      toolMode: 'select',
      layerVisibility: {},
      layerLocked: {},
      newWallWallType: 'external',
      newWallPlacement: 'on-axis',
      zoom: 1,
      panX: 0,
      panY: 0,
      snapEnabled: true,
      gridVisible: true,
    },
    history: { past: [], future: [], limit: DEFAULT_HISTORY_LIMIT },
  };
}

export interface EditorStoreActions {
  /** Загрузка документа с сервера: сброс истории, выделения, синхронизация draft/server. */
  loadDocumentFromServer: (input: {
    projectId: string;
    projectTitle: string | null;
    version: ProjectVersion;
  }) => void;
  /** Обновить id/title проекта до прихода версии (shell). */
  setProjectContext: (projectId: string, projectTitle: string | null) => void;
  applyCommand: (command: EditorCommand) => { ok: true } | { ok: false; error: string };
  beginSave: () => void;
  applySaveSuccess: (version: ProjectVersion) => void;
  markSaveConflict: () => void;
  markSaveError: (message: string) => void;
  /** Сброс черновика к serverModel + очистка истории. */
  discardDraft: () => void;
  saveDraft: (performSave: () => Promise<ProjectVersion>) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selectObject: (objectId: string, objectType: EditorObjectType) => void;
  clearSelection: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  setActiveFloor: (floorId: string | null) => void;
  setToolMode: (mode: CanvasToolMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setNewWallWallType: (wallType: import('@2wix/shared-types').WallType) => void;
  setNewWallPlacement: (placement: import('@2wix/shared-types').WallPlacementMode) => void;
  setActiveEditorLayer: (layerId: string | null) => void;
  setLayerVisibility: (layerKey: string, visible: boolean) => void;
  setLayerLocked: (layerKey: string, locked: boolean) => void;
  reset: () => void;
}

export type EditorStore = EditorState & EditorStoreActions;

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...createInitialEditorState(),

  reset: () => set(createInitialEditorState()),

  setProjectContext: (projectId, projectTitle) =>
    set((s) => ({
      document: { ...s.document, projectId, projectTitle },
    })),

  loadDocumentFromServer: (input) => {
    const prev = get();
    const { projectId, projectTitle, version } = input;
    const synced = syncBuildingModelMeta(cloneBuildingModel(version.buildingModel), {
      projectId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      projectTitle: projectTitle ?? undefined,
    });
    const withStale = syncRoofStaleFromSignatures(
      syncSlabStaleFromSignatures(syncFoundationStaleFromSignatures(cloneBuildingModel(synced)))
    );
    const server = cloneBuildingModel(withStale);
    const draft = cloneBuildingModel(withStale);
    const base = createInitialEditorState();
    const firstFloorId = getFloorsSorted(draft)[0]?.id ?? null;
    const ui = draft.meta.editorUi;
    set({
      ...base,
      view: {
        ...base.view,
        activePanel: prev.view.activePanel,
        toolMode: 'select',
        newWallWallType: prev.view.newWallWallType ?? 'external',
        newWallPlacement: prev.view.newWallPlacement ?? 'on-axis',
        layerVisibility: { ...(ui?.layerVisibility ?? {}) },
        layerLocked: { ...(ui?.layerLocked ?? {}) },
        activeFloorId: firstFloorId,
        activeEditorLayerId: firstFloorId ? editorLayerFloorWalls(firstFloorId) : null,
      },
      document: {
        projectId,
        projectTitle,
        currentVersionId: version.id,
        currentVersionNumber: version.versionNumber,
        serverModel: server,
        draftModel: draft,
        schemaVersion: version.schemaVersion,
        saveStatus: 'saved',
        lastSavedAt: version.createdAt,
        lastError: null,
        hasUnsavedChanges: false,
      },
    });
  },

  applyCommand: (command) => {
    const state = get();
    const res = reduceCommand(state, command);
    if (!res.ok) return res;

    const h = { ...state.history };
    if (res.history.reset) {
      h.past = [];
      h.future = [];
    } else if (res.history.recordBefore && res.draftChanged && state.document.draftModel) {
      h.past = [...h.past, cloneBuildingModel(state.document.draftModel)];
      if (h.past.length > h.limit) {
        h.past = h.past.slice(-h.limit);
      }
      h.future = [];
    }

    set({ ...res.state, history: h });
    return { ok: true };
  },

  beginSave: () =>
    set((s) => ({
      document: {
        ...s.document,
        saveStatus: 'saving',
        lastError: null,
      },
    })),

  applySaveSuccess: (version) => {
    set((s) => {
      const projectId = s.document.projectId;
      if (!projectId) return s;

      const synced = syncBuildingModelMeta(cloneBuildingModel(version.buildingModel), {
        projectId,
        versionId: version.id,
        versionNumber: version.versionNumber,
        projectTitle: s.document.projectTitle ?? undefined,
      });
      const withStale = syncRoofStaleFromSignatures(
      syncSlabStaleFromSignatures(syncFoundationStaleFromSignatures(cloneBuildingModel(synced)))
    );
      const server = cloneBuildingModel(withStale);
      const draft = cloneBuildingModel(withStale);

      return {
        document: {
          ...s.document,
          currentVersionId: version.id,
          currentVersionNumber: version.versionNumber,
          schemaVersion: version.schemaVersion,
          serverModel: server,
          draftModel: draft,
          saveStatus: 'saved' as const,
          lastSavedAt: version.createdAt,
          lastError: null,
          hasUnsavedChanges: false,
        },
        history: { ...s.history, past: [], future: [] },
        selection: pruneSelectionForModel(s.selection, draft),
        view: clampActiveFloorToModel(s.view, draft),
      };
    });
  },

  markSaveConflict: () =>
    set((s) => ({
      document: { ...s.document, saveStatus: 'conflict' },
    })),

  markSaveError: (message) =>
    set((s) => ({
      document: {
        ...s.document,
        saveStatus: 'error',
        lastError: message,
      },
    })),

  discardDraft: () => {
    get().applyCommand({ type: 'resetDraftToServer' });
  },

  saveDraft: async (performSave) => {
    get().beginSave();
    try {
      const version = await performSave();
      get().applySaveSuccess(version);
    } catch (e) {
      get().markSaveError(e instanceof Error ? e.message : String(e));
    }
  },

  undo: () => {
    const state = get();
    const { draftModel, serverModel } = state.document;
    const { past, future, limit } = state.history;
    if (!draftModel || !serverModel || past.length === 0) return;

    const prevTop = past[past.length - 1]!;
    const newPast = past.slice(0, -1);
    const newFuture = [cloneBuildingModel(draftModel), ...future];
    const nextDraft = cloneBuildingModel(prevTop);
    const document = recomputeDocumentAfterDraftChange(state.document, nextDraft);

    set({
      document,
      history: { past: newPast, future: newFuture, limit },
      selection: pruneSelectionForModel(state.selection, nextDraft),
      view: clampActiveFloorToModel(state.view, nextDraft),
    });
  },

  redo: () => {
    const state = get();
    const { draftModel, serverModel } = state.document;
    const { past, future, limit } = state.history;
    if (!draftModel || !serverModel || future.length === 0) return;

    const nextTop = future[0]!;
    const newFuture = future.slice(1);
    const newPast = [...past, cloneBuildingModel(draftModel)];
    const trimmedPast = newPast.length > limit ? newPast.slice(-limit) : newPast;
    const nextDraft = cloneBuildingModel(nextTop);
    const document = recomputeDocumentAfterDraftChange(state.document, nextDraft);

    set({
      document,
      history: { past: trimmedPast, future: newFuture, limit },
      selection: pruneSelectionForModel(state.selection, nextDraft),
      view: clampActiveFloorToModel(state.view, nextDraft),
    });
  },

  canUndo: () => {
    const s = get();
    return (
      s.document.draftModel !== null &&
      s.document.serverModel !== null &&
      s.history.past.length > 0
    );
  },

  canRedo: () => {
    const s = get();
    return (
      s.document.draftModel !== null &&
      s.document.serverModel !== null &&
      s.history.future.length > 0
    );
  },

  selectObject: (objectId, objectType) => {
    get().applyCommand({ type: 'selectObject', objectId, objectType });
  },

  clearSelection: () => {
    get().applyCommand({ type: 'clearSelection' });
  },

  setActivePanel: (panel) => {
    get().applyCommand({ type: 'setActivePanel', panel });
  },

  setActiveFloor: (floorId) => {
    get().applyCommand({ type: 'setActiveFloor', floorId });
  },

  setToolMode: (mode) => {
    get().applyCommand({ type: 'setToolMode', mode });
  },

  setZoom: (zoom) => {
    get().applyCommand({ type: 'setZoom', zoom });
  },

  setPan: (panX, panY) => {
    get().applyCommand({ type: 'setPan', panX, panY });
  },

  toggleGrid: () => {
    get().applyCommand({ type: 'toggleGrid' });
  },

  toggleSnap: () => {
    get().applyCommand({ type: 'toggleSnap' });
  },

  setNewWallWallType: (wallType) => {
    get().applyCommand({ type: 'setNewWallWallType', wallType });
  },

  setNewWallPlacement: (placement) => {
    get().applyCommand({ type: 'setNewWallPlacement', placement });
  },

  setActiveEditorLayer: (layerId) => {
    get().applyCommand({ type: 'setActiveEditorLayer', layerId });
  },

  setLayerVisibility: (layerKey, visible) => {
    get().applyCommand({ type: 'setLayerVisibility', layerKey, visible });
  },

  setLayerLocked: (layerKey, locked) => {
    get().applyCommand({ type: 'setLayerLocked', layerKey, locked });
  },
}));
