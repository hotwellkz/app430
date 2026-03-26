import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { buildPreviewSceneModel } from './buildPreviewSceneModel';

function makeVersion(model = createEmptyBuildingModel('sync')): ProjectVersion {
  return {
    id: 'v1',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: model,
    createdAt: new Date().toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  };
}

describe('preview sync with draft model', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('изменения draft влияют на preview snapshot', () => {
    const model = createEmptyBuildingModel('sync');
    const floor = createFloor({
      label: '1 этаж',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    model.floors.push(floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(model),
    });

    const wall = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall }).ok).toBe(true);

    const draft = useEditorStore.getState().document.draftModel!;
    const scene = buildPreviewSceneModel(draft, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: true, openings: true, slabs: false, roof: false },
    });
    expect(scene.walls.length).toBeGreaterThan(0);
  });

  it('discard возвращает preview к serverModel', () => {
    const model = createEmptyBuildingModel('sync');
    const floor = createFloor({
      label: '1 этаж',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    model.floors.push(floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(model),
    });

    const wall = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 2500, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    useEditorStore.getState().applyCommand({ type: 'addWall', wall });
    useEditorStore.getState().discardDraft();

    const draft = useEditorStore.getState().document.draftModel!;
    const scene = buildPreviewSceneModel(draft, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: true, openings: true, slabs: false, roof: false },
    });
    expect(scene.walls.length).toBe(0);
  });

  it('active floor only фильтрует видимый набор', () => {
    const model = createEmptyBuildingModel('sync');
    const f1 = createFloor({
      label: '1 этаж',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    const f2 = createFloor({
      label: '2 этаж',
      level: 2,
      elevationMm: 2800,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 1,
    });
    model.floors.push(f1, f2);
    model.walls.push(
      createWall({
        floorId: f1.id,
        start: { x: 0, y: 0 },
        end: { x: 2000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: f2.id,
        start: { x: 0, y: 0 },
        end: { x: 2400, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    const all = buildPreviewSceneModel(model, {
      activeFloorId: f1.id,
      floorMode: 'all',
      layers: { walls: true, openings: false, slabs: false, roof: false },
    });
    const onlyActive = buildPreviewSceneModel(model, {
      activeFloorId: f1.id,
      floorMode: 'active-only',
      layers: { walls: true, openings: false, slabs: false, roof: false },
    });
    expect(all.walls.length).toBeGreaterThan(onlyActive.walls.length);
  });
});
