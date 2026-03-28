import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  createEmptyBuildingModel,
  createFloor,
  createRoof,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user1',
  };
}

describe('layer clear commands', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('clearFloorWallsLayer clears only active floor walls', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    const f2 = createFloor({ label: '2', level: 2, elevationMm: 3000, sortIndex: 1 });
    let m = createEmptyBuildingModel();
    m.floors.push(f1, f2);
    m.walls.push(
      createWall({
        floorId: f1.id,
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: f2.id,
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 'T',
      version: sampleVersion(m),
    });
    useEditorStore.getState().setActiveFloor(f1.id);
    expect(useEditorStore.getState().document.draftModel?.walls.length).toBe(2);
    const r = useEditorStore.getState().applyCommand({
      type: 'clearFloorWallsLayer',
      floorId: f1.id,
    });
    expect(r.ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel?.walls.length).toBe(1);
    expect(useEditorStore.getState().document.draftModel?.walls[0]?.floorId).toBe(f2.id);
  });

  it('clearRoofsLayer + undo restores roofs', () => {
    const f1 = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    let m = createEmptyBuildingModel();
    m.floors.push(f1);
    m.roofs = [
      createRoof({
        id: 'r1',
        floorId: f1.id,
        roofType: 'gable',
        slopeDegrees: 30,
      }),
    ];
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 'T',
      version: sampleVersion(m),
    });
    useEditorStore.getState().applyCommand({ type: 'clearRoofsLayer' });
    expect(useEditorStore.getState().document.draftModel?.roofs.length).toBe(0);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel?.roofs.length).toBe(1);
  });
});
