import type { BuildingModel } from '@2wix/shared-types';
import {
  addFloorToModel,
  addOpeningToModel,
  addWallToModel,
  cloneBuildingModel,
  deleteOpeningFromModel,
  deleteWallFromModel,
  duplicateFloorInModel,
  getFloorById,
  getFloorsSorted,
  tryDeleteFloorFromModel,
  updateFloorInModel,
  updateOpeningInModel,
  updateWallInModel,
  validateFloorShape,
} from '@2wix/domain-model';
import type { EditorCommand } from '../commands/editorCommands.js';
import {
  isHistoryResetCommand,
  isModelMutationCommand,
} from '../commands/editorCommands.js';
import type { EditorState } from '../types/state.js';
import { clampEditorZoom } from './viewClamp.js';
import { recomputeDocumentAfterDraftChange } from './documentDraft.js';
import { pruneSelectionForModel } from './selectionPrune.js';

export type ReduceCommandResult =
  | {
      ok: true;
      state: EditorState;
      draftChanged: boolean;
      history: { recordBefore: boolean; reset: boolean };
    }
  | { ok: false; error: string };

function withDraft(
  state: EditorState,
  draft: BuildingModel | null,
  options?: { pruneSelection?: boolean }
): EditorState {
  const doc = recomputeDocumentAfterDraftChange(state.document, draft);
  const selection =
    draft && options?.pruneSelection !== false
      ? pruneSelectionForModel(state.selection, draft)
      : state.selection;
  return { ...state, document: doc, selection };
}

function historyMeta(cmd: EditorCommand): { recordBefore: boolean; reset: boolean } {
  if (isHistoryResetCommand(cmd)) {
    return { recordBefore: false, reset: true };
  }
  if (isModelMutationCommand(cmd)) {
    return { recordBefore: true, reset: false };
  }
  return { recordBefore: false, reset: false };
}

/** Чистый reducer: одна команда → новое состояние (история past/future не мутируется здесь). */
export function reduceCommand(state: EditorState, command: EditorCommand): ReduceCommandResult {
  const meta = historyMeta(command);

  switch (command.type) {
    case 'setDraftModel': {
      const draft = cloneBuildingModel(command.model);
      return {
        ok: true,
        draftChanged: true,
        history: { recordBefore: false, reset: true },
        state: withDraft(state, draft),
      };
    }
    case 'replaceDraftModel': {
      const draft = cloneBuildingModel(command.model);
      return {
        ok: true,
        draftChanged: true,
        history: { recordBefore: false, reset: true },
        state: withDraft(state, draft),
      };
    }
    case 'resetDraftToServer': {
      const server = state.document.serverModel;
      if (!server) {
        return { ok: false, error: 'Нет serverModel для сброса' };
      }
      const draft = cloneBuildingModel(server);
      return {
        ok: true,
        draftChanged: true,
        history: { recordBefore: false, reset: true },
        state: {
          ...withDraft(state, draft),
          selection: {
            selectedObjectId: null,
            selectedObjectType: null,
            hoveredObjectId: null,
            hoveredObjectType: null,
            multiSelectIds: [],
          },
        },
      };
    }
    case 'setMetaName': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = {
        ...draft,
        meta: { ...draft.meta, name: command.name },
      };
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'addFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const v = validateFloorShape(command.floor);
      if (v) return { ok: false, error: v };
      const next = addFloorToModel(draft, command.floor);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'updateFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateFloorInModel(draft, command.floorId, command.patch);
      if (!result.ok) return { ok: false, error: result.reason };
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, result.model),
      };
    }
    case 'duplicateFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const dup = duplicateFloorInModel(draft, command.sourceFloorId);
      if (!dup.ok) return { ok: false, error: dup.error };
      const view = { ...state.view, activeFloorId: dup.newFloorId };
      const selection = {
        ...state.selection,
        selectedObjectId: dup.newFloorId,
        selectedObjectType: 'floor' as const,
        multiSelectIds: [],
      };
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft({ ...state, view, selection }, dup.model),
      };
    }
    case 'deleteFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const removed = tryDeleteFloorFromModel(draft, command.floorId);
      if (!removed.ok) return { ok: false, error: removed.error };
      const next = removed.model;
      let view = state.view;
      const deletedId = command.floorId;
      if (
        view.activeFloorId === deletedId ||
        (view.activeFloorId != null &&
          !next.floors.some((f) => f.id === view.activeFloorId))
      ) {
        view = { ...view, activeFloorId: getFloorsSorted(next)[0]?.id ?? null };
      }
      const sel =
        state.selection.selectedObjectType === 'floor' &&
        state.selection.selectedObjectId === command.floorId
          ? {
              ...state.selection,
              selectedObjectId: null,
              selectedObjectType: null,
              multiSelectIds: [],
            }
          : state.selection;
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft({ ...state, view, selection: sel }, next),
      };
    }
    case 'addWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = addWallToModel(draft, command.wall);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, result as BuildingModel),
      };
    }
    case 'updateWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateWallInModel(draft, command.wallId, command.patch);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, result as BuildingModel),
      };
    }
    case 'deleteWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = deleteWallFromModel(draft, command.wallId);
      const sel =
        state.selection.selectedObjectType === 'wall' &&
        state.selection.selectedObjectId === command.wallId
          ? {
              ...state.selection,
              selectedObjectId: null,
              selectedObjectType: null,
              multiSelectIds: [],
            }
          : state.selection;
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft({ ...state, selection: sel }, next),
      };
    }
    case 'addOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = addOpeningToModel(draft, command.opening);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, result as BuildingModel),
      };
    }
    case 'updateOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateOpeningInModel(draft, command.openingId, command.patch);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, result as BuildingModel),
      };
    }
    case 'deleteOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = deleteOpeningFromModel(draft, command.openingId);
      const sel =
        state.selection.selectedObjectType === 'opening' &&
        state.selection.selectedObjectId === command.openingId
          ? {
              ...state.selection,
              selectedObjectId: null,
              selectedObjectType: null,
              multiSelectIds: [],
            }
          : state.selection;
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft({ ...state, selection: sel }, next),
      };
    }
    case 'selectObject':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          selection: {
            ...state.selection,
            selectedObjectId: command.objectId,
            selectedObjectType: command.objectType,
            multiSelectIds: [],
          },
        },
      };
    case 'clearSelection':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          selection: {
            selectedObjectId: null,
            selectedObjectType: null,
            hoveredObjectId: null,
            hoveredObjectType: null,
            multiSelectIds: [],
          },
        },
      };
    case 'setHoveredObject':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          selection: {
            ...state.selection,
            hoveredObjectId: command.objectId,
            hoveredObjectType: command.objectType,
          },
        },
      };
    case 'setActivePanel':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, activePanel: command.panel },
        },
      };
    case 'setActiveFloor': {
      if (command.floorId !== null) {
        const draft = state.document.draftModel;
        if (draft && !getFloorById(draft, command.floorId)) {
          return { ok: false, error: 'Этаж не найден' };
        }
      }
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, activeFloorId: command.floorId },
        },
      };
    }
    case 'setToolMode':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, toolMode: command.mode },
        },
      };
    case 'setZoom': {
      const z = clampEditorZoom(command.zoom);
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, zoom: z },
        },
      };
    }
    case 'setPan':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: {
            ...state.view,
            panX: command.panX,
            panY: command.panY,
          },
        },
      };
    case 'toggleGrid':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, gridVisible: !state.view.gridVisible },
        },
      };
    case 'toggleSnap':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, snapEnabled: !state.view.snapEnabled },
        },
      };
    default: {
      const _exhaustive: never = command;
      return { ok: false, error: `Неизвестная команда: ${(_exhaustive as EditorCommand).type}` };
    }
  }
}

/** Алиас по контракту ТЗ: executeCommand(command, state). */
export function executeCommand(command: EditorCommand, state: EditorState): ReduceCommandResult {
  return reduceCommand(state, command);
}
