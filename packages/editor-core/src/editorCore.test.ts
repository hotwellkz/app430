import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  createRoof,
  createSlab,
  compareBuildingModelsForDirtyCheck,
  createEmptyBuildingModel,
  createFloor,
  createOpening,
  createWall,
} from '@2wix/domain-model';
import { executeCommand } from './pure/reduceCommand.js';
import { createInitialEditorState, useEditorStore } from './store/editorStore.js';

function sampleVersion(model = createEmptyBuildingModel()): ProjectVersion {
  return {
    id: 'v1',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: model,
    createdAt: '2025-01-01T00:00:00.000Z',
    createdBy: 'user1',
  };
}

describe('editor-core', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('loadDocumentFromServer initializes clean state', () => {
    const empty = createEmptyBuildingModel();
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 'Проект A',
      version: sampleVersion(empty),
    });
    const s = useEditorStore.getState();
    expect(s.document.hasUnsavedChanges).toBe(false);
    expect(s.document.saveStatus).toBe('saved');
    expect(s.document.draftModel).not.toBeNull();
    expect(s.document.serverModel).not.toBeNull();
    expect(
      compareBuildingModelsForDirtyCheck(s.document.draftModel!, s.document.serverModel!)
    ).toBe(true);
    expect(s.history.past).toHaveLength(0);
    expect(s.history.future).toHaveLength(0);
    expect(s.selection.selectedObjectId).toBeNull();
  });

  it('apply edit command sets dirty state', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    const r = useEditorStore.getState().applyCommand({ type: 'setMetaName', name: 'Другое имя' });
    expect(r.ok).toBe(true);
    const s = useEditorStore.getState();
    expect(s.document.hasUnsavedChanges).toBe(true);
    expect(s.document.saveStatus).toBe('dirty');
  });

  it('undo after command restores previous draft', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    const before = useEditorStore.getState().document.draftModel!.meta.name;
    useEditorStore.getState().applyCommand({ type: 'setMetaName', name: 'После правки' });
    expect(useEditorStore.getState().document.draftModel!.meta.name).toBe('После правки');
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.meta.name).toBe(before);
    expect(useEditorStore.getState().document.hasUnsavedChanges).toBe(false);
  });

  it('redo reapplies command', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    useEditorStore.getState().applyCommand({ type: 'setMetaName', name: 'X' });
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel!.meta.name).toBe('X');
    expect(useEditorStore.getState().document.hasUnsavedChanges).toBe(true);
  });

  it('discardDraft resets to server model', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    useEditorStore.getState().applyCommand({ type: 'setMetaName', name: 'Грязь' });
    expect(useEditorStore.getState().document.hasUnsavedChanges).toBe(true);
    useEditorStore.getState().discardDraft();
    const s = useEditorStore.getState();
    expect(s.document.hasUnsavedChanges).toBe(false);
    expect(compareBuildingModelsForDirtyCheck(s.document.draftModel!, s.document.serverModel!)).toBe(
      true
    );
    expect(s.history.past).toHaveLength(0);
  });

  it('applySaveSuccess syncs server and draft models', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    useEditorStore.getState().applyCommand({ type: 'setMetaName', name: 'Сохранено имя' });
    const draft = useEditorStore.getState().document.draftModel!;
    const nextVersion: ProjectVersion = {
      id: 'v1',
      projectId: 'p1',
      versionNumber: 1,
      schemaVersion: 2,
      buildingModel: draft,
      createdAt: '2025-01-01T00:00:00.000Z',
      createdBy: 'user1',
    };
    useEditorStore.getState().applySaveSuccess(nextVersion);
    const s = useEditorStore.getState();
    expect(s.document.hasUnsavedChanges).toBe(false);
    expect(s.document.saveStatus).toBe('saved');
    expect(s.history.past).toHaveLength(0);
  });

  it('selection clears when selected wall deleted', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = createEmptyBuildingModel();
    const withFloor = { ...model, floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(withFloor),
    });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    useEditorStore.getState().applyCommand({ type: 'addWall', wall });
    useEditorStore.getState().selectObject('w1', 'wall');
    expect(useEditorStore.getState().selection.selectedObjectId).toBe('w1');
    useEditorStore.getState().applyCommand({ type: 'deleteWall', wallId: 'w1' });
    expect(useEditorStore.getState().selection.selectedObjectId).toBeNull();
  });

  it('addWall command adds valid wall', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const wall = createWall({
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 2000, y: 0 },
      thicknessMm: 200,
    });
    const r = useEditorStore.getState().applyCommand({ type: 'addWall', wall });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.walls).toHaveLength(1);
  });

  it('invalid wall command rejected', () => {
    const model = createEmptyBuildingModel();
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const wall = createWall({
      floorId: 'missing-floor',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    const r = useEditorStore.getState().applyCommand({ type: 'addWall', wall });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('этаж');
  });

  it('view state changes do not pollute model history', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    const n = useEditorStore.getState().history.past.length;
    useEditorStore.getState().setZoom(1.5);
    useEditorStore.getState().setPan(10, 20);
    useEditorStore.getState().toggleGrid();
    useEditorStore.getState().setActivePanel('walls');
    expect(useEditorStore.getState().history.past.length).toBe(n);
    expect(useEditorStore.getState().view.zoom).toBe(1.5);
  });

  it('setToolMode does not grow history', () => {
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(),
    });
    const n = useEditorStore.getState().history.past.length;
    useEditorStore.getState().setToolMode('draw-wall');
    expect(useEditorStore.getState().history.past.length).toBe(n);
    expect(useEditorStore.getState().view.toolMode).toBe('draw-wall');
    useEditorStore.getState().setToolMode('draw-window');
    expect(useEditorStore.getState().view.toolMode).toBe('draw-window');
  });

  it('setActiveFloor does not grow history', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const n = useEditorStore.getState().history.past.length;
    useEditorStore.getState().setActiveFloor('f1');
    expect(useEditorStore.getState().history.past.length).toBe(n);
    expect(useEditorStore.getState().view.activeFloorId).toBe('f1');
  });

  it('setActiveFloor rejects unknown floor id', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const r = useEditorStore.getState().applyCommand({ type: 'setActiveFloor', floorId: 'nope' });
    expect(r.ok).toBe(false);
  });

  it('deleteFloor rejects last remaining floor', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const r = useEditorStore.getState().applyCommand({ type: 'deleteFloor', floorId: 'f1' });
    expect(r.ok).toBe(false);
  });

  it('deleteFloor removes linked walls and switches active floor', () => {
    const f1 = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const f2 = createFloor({ id: 'f2', label: '2', sortIndex: 1 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f2',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    const model = {
      ...createEmptyBuildingModel(),
      floors: [f1, f2],
      walls: [wall],
    };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    useEditorStore.getState().setActiveFloor('f2');
    const r = useEditorStore.getState().applyCommand({ type: 'deleteFloor', floorId: 'f2' });
    expect(r.ok).toBe(true);
    const s = useEditorStore.getState();
    expect(s.document.draftModel!.floors).toHaveLength(1);
    expect(s.document.draftModel!.walls).toHaveLength(0);
    expect(s.view.activeFloorId).toBe('f1');
  });

  it('duplicateFloor selects new floor and marks dirty', () => {
    const f1 = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 2000, y: 0 },
      thicknessMm: 200,
    });
    const model = { ...createEmptyBuildingModel(), floors: [f1], walls: [wall] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const r = useEditorStore.getState().applyCommand({ type: 'duplicateFloor', sourceFloorId: 'f1' });
    expect(r.ok).toBe(true);
    const s = useEditorStore.getState();
    expect(s.document.draftModel!.floors).toHaveLength(2);
    expect(s.document.draftModel!.walls).toHaveLength(2);
    expect(s.view.activeFloorId).not.toBe('f1');
    expect(s.selection.selectedObjectType).toBe('floor');
    expect(s.document.hasUnsavedChanges).toBe(true);
  });

  it('updateFloor changes height and undo restores', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const before = useEditorStore.getState().document.draftModel!.floors[0]!.heightMm;
    useEditorStore.getState().applyCommand({
      type: 'updateFloor',
      floorId: 'f1',
      patch: { heightMm: 3200 },
    });
    expect(useEditorStore.getState().document.draftModel!.floors[0]!.heightMm).toBe(3200);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.floors[0]!.heightMm).toBe(before);
  });

  it('addOpening marks dirty and undo removes opening', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 8000, y: 0 },
      thicknessMm: 200,
    });
    const model = { ...createEmptyBuildingModel(), floors: [floor], walls: [wall] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const opening = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const r = useEditorStore.getState().applyCommand({ type: 'addOpening', opening });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.hasUnsavedChanges).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.openings).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.openings).toHaveLength(0);
  });

  it('deleteOpening clears selection when opening was selected', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 8000, y: 0 },
      thicknessMm: 200,
    });
    const opening = createOpening({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 4000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'door',
    });
    const model = {
      ...createEmptyBuildingModel(),
      floors: [floor],
      walls: [wall],
      openings: [opening],
    };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    useEditorStore.getState().selectObject('o1', 'opening');
    useEditorStore.getState().applyCommand({ type: 'deleteOpening', openingId: 'o1' });
    expect(useEditorStore.getState().selection.selectedObjectId).toBeNull();
  });

  it('updateWall pushes history and undo restores geometry', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const model = { ...createEmptyBuildingModel(), floors: [floor] };
    const wall = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    });
    const withWall = { ...model, walls: [wall] };
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(withWall),
    });
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: 'w1',
      patch: { end: { x: 8000, y: 0 } },
    });
    expect(useEditorStore.getState().document.draftModel!.walls[0]!.end.x).toBe(8000);
    expect(useEditorStore.getState().history.past.length).toBeGreaterThan(0);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.walls[0]!.end.x).toBe(5000);
  });

  it('executeCommand(command, state) matches store applyCommand snapshot', () => {
    let state = createInitialEditorState();
    state = {
      ...state,
      document: {
        ...state.document,
        projectId: 'p1',
        serverModel: createEmptyBuildingModel(),
        draftModel: createEmptyBuildingModel(),
        schemaVersion: 2,
        saveStatus: 'saved',
        hasUnsavedChanges: false,
      },
    };
    const res = executeCommand({ type: 'setZoom', zoom: 2 }, state);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.view.zoom).toBe(2);
  });

  it('addSlab marks dirty and supports undo/redo', () => {
    const floor = createFloor({ id: 'f1', label: '1', sortIndex: 0 });
    const wall = createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2000, y: 0 }, thicknessMm: 200 });
    const model = { ...createEmptyBuildingModel(), floors: [floor], walls: [wall] };
    useEditorStore.getState().loadDocumentFromServer({ projectId: 'p1', projectTitle: null, version: sampleVersion(model) });
    const slab = createSlab({ id: 's1', floorId: 'f1', contourWallIds: ['w1'] });
    const r = useEditorStore.getState().applyCommand({ type: 'addSlab', slab });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.hasUnsavedChanges).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.slabs).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.slabs).toHaveLength(0);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel!.slabs).toHaveLength(1);
  });

  it('updateRoof marks dirty and supports undo/redo', () => {
    const floor = createFloor({ id: 'f1', sortIndex: 0 });
    const roof = createRoof({ id: 'r1', floorId: 'f1', baseElevationMm: 2800 });
    const model = { ...createEmptyBuildingModel(), floors: [floor], roofs: [roof] };
    useEditorStore.getState().loadDocumentFromServer({ projectId: 'p1', projectTitle: null, version: sampleVersion(model) });
    const r = useEditorStore.getState().applyCommand({ type: 'updateRoof', roofId: 'r1', patch: { slopeDegrees: 35 } });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.roofs[0]!.slopeDegrees).toBe(35);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.roofs[0]!.slopeDegrees).toBe(roof.slopeDegrees);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel!.roofs[0]!.slopeDegrees).toBe(35);
  });
});
