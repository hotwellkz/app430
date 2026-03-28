import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  addFloorToModel,
  baselineSegmentToCenterline,
  createEmptyBuildingModel,
  createFloor,
  createWall,
} from '@2wix/domain-model';
import { editorLayerFloorWalls } from './editorLayers.js';
import { useEditorStore } from './store/editorStore.js';

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

describe('manual wall workflow (layer + placement + model)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('after load, active floor has floor-walls editor layer', () => {
    const floor = createFloor({ label: '1 этаж', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 'T',
      version: sampleVersion(model),
    });
    const s = useEditorStore.getState();
    expect(s.view.activeFloorId).toBe(floor.id);
    expect(s.view.activeEditorLayerId).toBe(editorLayerFloorWalls(floor.id));
  });

  it('setActiveEditorLayer(floor-walls) keeps floor in sync', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    const f2 = createFloor({ label: '2', level: 2, elevationMm: 2800, sortIndex: 1 });
    let model = addFloorToModel(createEmptyBuildingModel(), f1);
    model = addFloorToModel(model, f2);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    useEditorStore.getState().applyCommand({
      type: 'setActiveEditorLayer',
      layerId: editorLayerFloorWalls(f1.id),
    });
    expect(useEditorStore.getState().view.activeFloorId).toBe(f1.id);
    expect(useEditorStore.getState().view.activeEditorLayerId).toBe(editorLayerFloorWalls(f1.id));
  });

  it('setNewWallPlacement updates view state', () => {
    const floor = createFloor({ label: '1 этаж', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    useEditorStore.getState().setNewWallPlacement('outside');
    expect(useEditorStore.getState().view.newWallPlacement).toBe('outside');
    useEditorStore.getState().setNewWallPlacement('inside');
    expect(useEditorStore.getState().view.newWallPlacement).toBe('inside');
  });

  it('addWall with wallPlacement and baseline offset lands in draftModel', () => {
    const floor = createFloor({ label: '1 этаж', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const t = 200;
    const baseA = { x: 0, y: 0 };
    const baseB = { x: 3000, y: 0 };
    const center = baselineSegmentToCenterline(baseA, baseB, t, 'inside');
    const w = createWall({
      floorId: floor.id,
      start: center.start,
      end: center.end,
      thicknessMm: t,
      wallPlacement: 'inside',
      wallType: 'external',
      structuralRole: 'bearing',
      panelizationEnabled: true,
      panelDirection: 'horizontal',
    });
    const r = useEditorStore.getState().applyCommand({ type: 'addWall', wall: w });
    expect(r.ok).toBe(true);
    const draft = useEditorStore.getState().document.draftModel!;
    expect(draft.walls).toHaveLength(1);
    expect(draft.walls[0]!.wallPlacement).toBe('inside');
    expect(draft.walls[0]!.floorId).toBe(floor.id);
    expect(draft.wallJoints?.length).toBe(2);
    expect(draft.walls[0]!.startJointId).toBeDefined();
    expect(draft.walls[0]!.endJointId).toBeDefined();
  });

  it('detachWallEndpoint и moveWallJoint применяются через команды', () => {
    const floor = createFloor({ label: '1 этаж', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const w = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 2000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall: w }).ok).toBe(true);
    let draft = useEditorStore.getState().document.draftModel!;
    const jid = draft.walls[0]!.startJointId!;
    expect(
      useEditorStore.getState().applyCommand({ type: 'moveWallJoint', jointId: jid, x: 50, y: 0 }).ok
    ).toBe(true);
    draft = useEditorStore.getState().document.draftModel!;
    expect(draft.walls[0]!.start.x).toBe(50);
    expect(
      useEditorStore.getState().applyCommand({
        type: 'detachWallEndpoint',
        wallId: draft.walls[0]!.id,
        endpoint: 'end',
      }).ok
    ).toBe(true);
    draft = useEditorStore.getState().document.draftModel!;
    expect(draft.walls[0]!.endJointId).toBeUndefined();
  });

  it('updateWall wallPlacement with geometry patch is accepted', () => {
    const floor = createFloor({ label: '1 этаж', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const w0 = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 2000, y: 0 },
      thicknessMm: 150,
      wallType: 'external',
      wallPlacement: 'on-axis',
    });
    useEditorStore.getState().applyCommand({ type: 'addWall', wall: w0 });
    const id = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    const r = useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: id,
      patch: { wallPlacement: 'outside' },
    });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.walls[0]!.wallPlacement).toBe('outside');
  });
});
