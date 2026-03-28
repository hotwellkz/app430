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

describe('slab commands', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('createSlabFromContour + contourMm + undo', () => {
    const floorId = loadRectExternalWalls();
    const r = useEditorStore.getState().applyCommand({
      type: 'createSlabFromContour',
      floorId,
    });
    expect(r.ok).toBe(true);
    const slab = useEditorStore.getState().document.draftModel!.slabs[0]!;
    expect(slab.contourMm?.length).toBeGreaterThanOrEqual(3);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.slabs).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.draftModel!.slabs).toHaveLength(1);
  });

  it('translateWall помечает перекрытие needsRecompute', () => {
    const floorId = loadRectExternalWalls();
    expect(useEditorStore.getState().applyCommand({ type: 'createSlabFromContour', floorId }).ok).toBe(true);
    const wallId = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    const r = useEditorStore.getState().applyCommand({
      type: 'translateWall',
      wallId,
      dxMm: 40,
      dyMm: 0,
    });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.slabs[0]!.needsRecompute).toBe(true);
  });

  it('recomputeSlab обновляет контур', () => {
    const floorId = loadRectExternalWalls();
    expect(useEditorStore.getState().applyCommand({ type: 'createSlabFromContour', floorId }).ok).toBe(true);
    const slabId = useEditorStore.getState().document.draftModel!.slabs[0]!.id;
    useEditorStore.getState().applyCommand({
      type: 'updateSlab',
      slabId,
      patch: { needsRecompute: true },
    });
    const r = useEditorStore.getState().applyCommand({ type: 'recomputeSlab', slabId });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.slabs[0]!.needsRecompute).toBe(false);
  });
});
