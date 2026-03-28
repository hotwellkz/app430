import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  buildFoundationAndScreedForFloor,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  upsertFoundationInModel,
} from '@2wix/domain-model';
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

function loadRectWalls() {
  const floor = createFloor({
    label: '1 этаж',
    level: 1,
    elevationMm: 0,
    heightMm: 2800,
    floorType: 'full',
    sortIndex: 0,
  });
  let model = createEmptyBuildingModel();
  model.floors.push(floor);
  const s = 5000;
  const t = 200;
  const walls = [
    createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: s, y: 0 },
      thicknessMm: t,
      wallType: 'external',
    }),
    createWall({
      floorId: floor.id,
      start: { x: s, y: 0 },
      end: { x: s, y: s },
      thicknessMm: t,
      wallType: 'external',
    }),
    createWall({
      floorId: floor.id,
      start: { x: s, y: s },
      end: { x: 0, y: s },
      thicknessMm: t,
      wallType: 'external',
    }),
    createWall({
      floorId: floor.id,
      start: { x: 0, y: s },
      end: { x: 0, y: 0 },
      thicknessMm: t,
      wallType: 'external',
    }),
  ];
  model.walls.push(...walls);
  useEditorStore.getState().loadDocumentFromServer({
    projectId: 'p1',
    projectTitle: 'T',
    version: sampleVersion(model),
  });
  return floor.id;
}

describe('foundation commands', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('createFoundationFromContour + undo/redo', () => {
    const floorId = loadRectWalls();
    const r = useEditorStore.getState().applyCommand({
      type: 'createFoundationFromContour',
      floorId,
    });
    expect(r.ok).toBe(true);
    const draft = useEditorStore.getState().document.draftModel!;
    expect(draft.foundations?.length).toBe(1);
    expect(draft.groundScreeds?.length).toBe(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel?.foundations?.length ?? 0).toBe(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel?.foundations?.length).toBe(1);
  });

  it('translateWall помечает фундамент как needsRecompute', () => {
    const floorId = loadRectWalls();
    expect(
      useEditorStore.getState().applyCommand({ type: 'createFoundationFromContour', floorId }).ok
    ).toBe(true);
    const wallId = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    const r = useEditorStore.getState().applyCommand({
      type: 'translateWall',
      wallId,
      dxMm: 50,
      dyMm: 0,
    });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.foundations![0]!.needsRecompute).toBe(true);
  });

  it('loadDocumentFromServer синхронизирует needsRecompute по подписи', () => {
    const floor = createFloor({
      label: '1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    let model = createEmptyBuildingModel();
    model.floors.push(floor);
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 4000, y: 0 },
        end: { x: 4000, y: 4000 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 4000, y: 4000 },
        end: { x: 0, y: 4000 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 4000 },
        end: { x: 0, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    const built = buildFoundationAndScreedForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    model = upsertFoundationInModel(model, built.foundation, built.screed);
    model.walls[0] = {
      ...model.walls[0]!,
      start: { x: model.walls[0]!.start.x + 500, y: model.walls[0]!.start.y },
      end: { x: model.walls[0]!.end.x + 500, y: model.walls[0]!.end.y },
    };

    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    expect(useEditorStore.getState().document.draftModel!.foundations![0]!.needsRecompute).toBe(true);
  });
});
