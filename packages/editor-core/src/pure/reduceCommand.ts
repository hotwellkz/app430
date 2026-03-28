import type { BuildingModel } from '@2wix/shared-types';
import {
  addFloorToModel,
  addOpeningToModel,
  addWallToModel,
  attachWallEndpointsToJoints,
  cloneBuildingModel,
  findWallById,
  deleteOpeningFromModel,
  deleteWallFromModel,
  detachWallEndpointInModel,
  duplicateFloorInModel,
  getFloorById,
  getFloorsSorted,
  moveWallJointInModel,
  recomputeManualBuildingGeometry,
  tryDeleteFloorFromModel,
  translateWallEndpoints,
  updateFloorInModel,
  addSlabToModel,
  addRoofToModel,
  deleteSlabFromModel,
  deleteRoofFromModel,
  updateSlabInModel,
  updateRoofInModel,
  updateOpeningInModel,
  updateWallInModel,
  validateFloorShape,
  buildFoundationAndScreedForFloor,
  upsertFoundationInModel,
  recomputeFoundationById,
  deleteFoundationById,
  updateFoundationInModel,
  updateGroundScreedInModel,
  findGroundScreedByFloor,
  buildRoofAssemblyForFloor,
  buildSlabAssemblyForFloor,
  markFloorStructuralStale,
  recomputeRoofById,
  recomputeSlabById,
  clearWallsForFloor,
  clearOpeningsForFloor,
  clearFoundationsAndScreeds,
  clearSlabs,
  clearRoofs,
  mergeWallPanelLayouts,
  upsertWallPanelLayout,
  clearWallPanelLayout,
  clearWallPanelLayoutsForFloor,
  markWallPanelLayoutsStaleForWallIds,
  getOpeningById,
} from '@2wix/domain-model';
import {
  batchComputeWallPanelLayoutsForFloor,
  computeWallPanelLayoutForWall,
} from '@2wix/panel-engine';
import {
  editorLayerFloorWalls,
  parseFloorIdFromEditorLayer,
} from '../editorLayers.js';
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
      const view = {
        ...state.view,
        activeFloorId: dup.newFloorId,
        activeEditorLayerId: editorLayerFloorWalls(dup.newFloorId),
      };
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
        const nf = getFloorsSorted(next)[0]?.id ?? null;
        view = {
          ...view,
          activeFloorId: nf,
          activeEditorLayerId: nf ? editorLayerFloorWalls(nf) : null,
        };
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
      const withJoints = attachWallEndpointsToJoints(result as BuildingModel, command.wall.id, 160);
      const marked = markFloorStructuralStale(withJoints, command.wall.floorId);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, marked),
      };
    }
    case 'updateWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateWallInModel(draft, command.wallId, command.patch);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      const wf = findWallById(draft, command.wallId);
      const floorId = wf?.floorId;
      let after = markWallPanelLayoutsStaleForWallIds(result as BuildingModel, [command.wallId]);
      if (floorId) {
        after = markFloorStructuralStale(after, floorId);
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, after),
      };
    }
    case 'deleteWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const wBefore = findWallById(draft, command.wallId);
      let next = deleteWallFromModel(draft, command.wallId);
      if (wBefore?.floorId) {
        next = markFloorStructuralStale(next, wBefore.floorId);
      }
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
    case 'updatePanelSettings': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = {
        ...draft,
        panelSettings: {
          ...draft.panelSettings,
          ...command.patch,
        },
      };
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'addOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = addOpeningToModel(draft, command.opening);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      const after = markWallPanelLayoutsStaleForWallIds(result as BuildingModel, [command.opening.wallId]);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, after),
      };
    }
    case 'updateOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const before = getOpeningById(draft, command.openingId);
      const result = updateOpeningInModel(draft, command.openingId, command.patch);
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      const afterModel = result as BuildingModel;
      const afterOp = getOpeningById(afterModel, command.openingId);
      const wallIds = [before?.wallId, afterOp?.wallId].filter((x): x is string => Boolean(x));
      const after = markWallPanelLayoutsStaleForWallIds(afterModel, [...new Set(wallIds)]);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, after),
      };
    }
    case 'deleteOpening': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const op = getOpeningById(draft, command.openingId);
      let next = deleteOpeningFromModel(draft, command.openingId);
      if (op?.wallId) {
        next = markWallPanelLayoutsStaleForWallIds(next, [op.wallId]);
      }
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
    case 'addSlab': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = addSlabToModel(draft, command.slab);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'updateSlab': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateSlabInModel(draft, command.slabId, command.patch);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'deleteSlab': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = deleteSlabFromModel(draft, command.slabId);
      const sel =
        state.selection.selectedObjectType === 'slab' &&
        state.selection.selectedObjectId === command.slabId
          ? { ...state.selection, selectedObjectId: null, selectedObjectType: null, multiSelectIds: [] }
          : state.selection;
      return { ok: true, draftChanged: true, history: meta, state: withDraft({ ...state, selection: sel }, next) };
    }
    case 'createSlabFromContour': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const existing = draft.slabs.find((s) => s.floorId === command.floorId);
      let m = draft;
      if (existing) {
        m = deleteSlabFromModel(m, existing.id);
      }
      const built = buildSlabAssemblyForFloor(m, command.floorId);
      if (!built.ok) return { ok: false, error: built.reason };
      const result = addSlabToModel(m, built.slab);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'recomputeSlab': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const rec = recomputeSlabById(draft, command.slabId);
      if (!rec.ok) return { ok: false, error: rec.reason };
      const slabs = draft.slabs.map((s) => (s.id === command.slabId ? rec.slab : s));
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, { ...draft, slabs }),
      };
    }
    case 'createRoofFromContour': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const sorted = getFloorsSorted(draft);
      const top = sorted[sorted.length - 1];
      if (!top || top.id !== command.floorId) {
        return { ok: false, error: 'Крыша создаётся только на верхнем этаже' };
      }
      let m = draft;
      const existing = m.roofs.find((r) => r.floorId === command.floorId);
      if (existing) {
        m = deleteRoofFromModel(m, existing.id);
      }
      const built = buildRoofAssemblyForFloor(m, command.floorId);
      if (!built.ok) return { ok: false, error: built.reason };
      const result = addRoofToModel(m, built.roof);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'recomputeRoof': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const rec = recomputeRoofById(draft, command.roofId);
      if (!rec.ok) return { ok: false, error: rec.reason };
      const roofs = draft.roofs.map((r) => (r.id === command.roofId ? rec.roof : r));
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, { ...draft, roofs }) };
    }
    case 'addRoof': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = addRoofToModel(draft, command.roof);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'updateRoof': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const result = updateRoofInModel(draft, command.roofId, command.patch);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true, draftChanged: true, history: meta, state: withDraft(state, result.model) };
    }
    case 'deleteRoof': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = deleteRoofFromModel(draft, command.roofId);
      const sel =
        state.selection.selectedObjectType === 'roof' &&
        state.selection.selectedObjectId === command.roofId
          ? { ...state.selection, selectedObjectId: null, selectedObjectType: null, multiSelectIds: [] }
          : state.selection;
      return { ok: true, draftChanged: true, history: meta, state: withDraft({ ...state, selection: sel }, next) };
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
      let nextLayer: string | null = null;
      if (command.floorId !== null) {
        const prev = state.view.activeEditorLayerId;
        const prevFloor = parseFloorIdFromEditorLayer(prev);
        if (prevFloor === command.floorId && prev) {
          nextLayer = prev;
        } else {
          nextLayer = editorLayerFloorWalls(command.floorId);
        }
      }
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: {
            ...state.view,
            activeFloorId: command.floorId,
            activeEditorLayerId: nextLayer,
          },
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
    case 'setNewWallWallType':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, newWallWallType: command.wallType },
        },
      };
    case 'setNewWallPlacement':
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: { ...state.view, newWallPlacement: command.placement },
        },
      };
    case 'setActiveEditorLayer': {
      const layerId = command.layerId;
      const fid = parseFloorIdFromEditorLayer(layerId);
      const draft = state.document.draftModel;
      if (fid && draft && !getFloorById(draft, fid)) {
        return { ok: false, error: 'Этаж не найден' };
      }
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: {
            ...state.view,
            activeEditorLayerId: layerId,
            ...(fid ? { activeFloorId: fid } : {}),
          },
        },
      };
    }
    case 'setLayerVisibility': {
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: {
            ...state.view,
            layerVisibility: {
              ...state.view.layerVisibility,
              [command.layerKey]: command.visible,
            },
          },
        },
      };
    }
    case 'setLayerLocked': {
      return {
        ok: true,
        draftChanged: false,
        history: meta,
        state: {
          ...state,
          view: {
            ...state.view,
            layerLocked: {
              ...state.view.layerLocked,
              [command.layerKey]: command.locked,
            },
          },
        },
      };
    }
    case 'recomputeManualGeometry': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = recomputeManualBuildingGeometry(draft);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'moveWallJoint': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const r = moveWallJointInModel(draft, command.jointId, { x: command.x, y: command.y });
      if ('ok' in r && (r as { ok?: boolean }).ok === false) {
        return { ok: false, error: (r as { reason: string }).reason };
      }
      let afterMove = r as BuildingModel;
      const j = (afterMove.wallJoints ?? []).find((x) => x.id === command.jointId);
      if (j?.floorId) {
        afterMove = markFloorStructuralStale(afterMove, j.floorId);
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, afterMove),
      };
    }
    case 'detachWallEndpoint': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const wBeforeDetach = findWallById(draft, command.wallId);
      const r = detachWallEndpointInModel(draft, command.wallId, command.endpoint);
      if ('ok' in r && (r as { ok?: boolean }).ok === false) {
        return { ok: false, error: (r as { reason: string }).reason };
      }
      let afterDetach = r as BuildingModel;
      afterDetach = markWallPanelLayoutsStaleForWallIds(afterDetach, [command.wallId]);
      if (wBeforeDetach?.floorId) {
        afterDetach = markFloorStructuralStale(afterDetach, wBeforeDetach.floorId);
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, afterDetach),
      };
    }
    case 'translateWall': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const w = findWallById(draft, command.wallId);
      if (!w) return { ok: false, error: 'Стена не найдена' };
      const axis = command.axis ?? 'both';
      const g = translateWallEndpoints(w, command.dxMm, command.dyMm, axis);
      const result = updateWallInModel(draft, command.wallId, { start: g.start, end: g.end });
      if ('ok' in result && result.ok === false) {
        return { ok: false, error: result.reason };
      }
      let after = markWallPanelLayoutsStaleForWallIds(result as BuildingModel, [command.wallId]);
      if (w.floorId) {
        after = markFloorStructuralStale(after, w.floorId);
      }
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, after),
      };
    }
    case 'createFoundationFromContour': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const built = buildFoundationAndScreedForFloor(draft, command.floorId);
      if (!built.ok) return { ok: false, error: built.reason };
      const next = upsertFoundationInModel(draft, built.foundation, built.screed);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'updateFoundation': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const f = (draft.foundations ?? []).find((x) => x.id === command.foundationId);
      if (!f) return { ok: false, error: 'Фундамент не найден' };
      const p = command.patch;
      const patchF: {
        widthMm?: number;
        heightMm?: number;
        outerOffsetMm?: number;
        innerOffsetMm?: number;
      } = {};
      if (p.widthMm !== undefined) patchF.widthMm = p.widthMm;
      if (p.heightMm !== undefined) patchF.heightMm = p.heightMm;
      if (p.outerOffsetMm !== undefined) patchF.outerOffsetMm = p.outerOffsetMm;
      if (p.innerOffsetMm !== undefined) patchF.innerOffsetMm = p.innerOffsetMm;
      let next = updateFoundationInModel(draft, command.foundationId, patchF);
      const screed = findGroundScreedByFloor(next, f.floorId);
      if (p.screedThicknessMm !== undefined && screed) {
        next = updateGroundScreedInModel(next, screed.id, { thicknessMm: p.screedThicknessMm });
      }
      const rec = recomputeFoundationById(next, command.foundationId);
      if (!rec.ok) return { ok: false, error: rec.reason };
      next = upsertFoundationInModel(next, rec.foundation, rec.screed);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'recomputeFoundation': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const rec = recomputeFoundationById(draft, command.foundationId);
      if (!rec.ok) return { ok: false, error: rec.reason };
      const next = upsertFoundationInModel(draft, rec.foundation, rec.screed);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'deleteFoundation': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = deleteFoundationById(draft, command.foundationId);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'calculateWallPanelLayout': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const r = computeWallPanelLayoutForWall(draft, command.wallId);
      if (!r) return { ok: false, error: 'Стена не найдена' };
      const next = upsertWallPanelLayout(draft, r.layoutResult);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearWallPanelLayout': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = clearWallPanelLayout(draft, command.wallId);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'batchCalculateWallPanelLayoutsForFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const { layouts } = batchComputeWallPanelLayoutsForFloor(draft, command.floorId);
      const next = mergeWallPanelLayouts(draft, layouts);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearWallPanelLayoutsForFloor': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = clearWallPanelLayoutsForFloor(draft, command.floorId);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearFloorWallsLayer': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      let next = clearWallsForFloor(draft, command.floorId);
      next = markFloorStructuralStale(next, command.floorId);
      next = recomputeManualBuildingGeometry(next);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearFloorOpeningsLayer': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      let next = clearOpeningsForFloor(draft, command.floorId);
      next = markFloorStructuralStale(next, command.floorId);
      next = recomputeManualBuildingGeometry(next);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearFoundationLayer': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      const next = recomputeManualBuildingGeometry(clearFoundationsAndScreeds(draft));
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearSlabsLayer': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      let next = clearSlabs(draft);
      for (const fid of new Set(draft.slabs.map((s) => s.floorId))) {
        next = markFloorStructuralStale(next, fid);
      }
      next = recomputeManualBuildingGeometry(next);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
    case 'clearRoofsLayer': {
      const draft = state.document.draftModel;
      if (!draft) return { ok: false, error: 'Нет черновика модели' };
      let next = clearRoofs(draft);
      for (const fid of new Set(draft.roofs.map((r) => r.floorId))) {
        next = markFloorStructuralStale(next, fid);
      }
      next = recomputeManualBuildingGeometry(next);
      return {
        ok: true,
        draftChanged: true,
        history: meta,
        state: withDraft(state, next),
      };
    }
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
