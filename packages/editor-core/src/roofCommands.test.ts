import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  createEmptyBuildingModel,
  createFloor,
  createWall,
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

function loadRectExternalWalls() {
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
  model.walls.push(
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
    })
  );
  useEditorStore.getState().loadDocumentFromServer({
    projectId: 'p1',
    projectTitle: 'T',
    version: sampleVersion(model),
  });
  return floor.id;
}

describe('roof commands', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('createRoofFromContour + eavesContourMm + undo', () => {
    const floorId = loadRectExternalWalls();
    const r = useEditorStore.getState().applyCommand({
      type: 'createRoofFromContour',
      floorId,
    });
    expect(r.ok).toBe(true);
    const roof = useEditorStore.getState().document.draftModel!.roofs[0]!;
    expect(roof.eavesContourMm?.length).toBeGreaterThanOrEqual(3);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.roofs).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel!.roofs).toHaveLength(1);
  });

  it('translateWall помечает крышу needsRecompute', () => {
    const floorId = loadRectExternalWalls();
    expect(useEditorStore.getState().applyCommand({ type: 'createRoofFromContour', floorId }).ok).toBe(true);
    const wallId = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    const r = useEditorStore.getState().applyCommand({
      type: 'translateWall',
      wallId,
      dxMm: 40,
      dyMm: 0,
    });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.roofs[0]!.needsRecompute).toBe(true);
  });

  it('recomputeRoof обновляет контур', () => {
    const floorId = loadRectExternalWalls();
    expect(useEditorStore.getState().applyCommand({ type: 'createRoofFromContour', floorId }).ok).toBe(true);
    const roofId = useEditorStore.getState().document.draftModel!.roofs[0]!.id;
    useEditorStore.getState().applyCommand({
      type: 'updateRoof',
      roofId,
      patch: { needsRecompute: true },
    });
    const r = useEditorStore.getState().applyCommand({ type: 'recomputeRoof', roofId });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.roofs[0]!.needsRecompute).toBe(false);
  });
});
