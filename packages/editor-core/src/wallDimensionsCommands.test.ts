import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  addFloorToModel,
  baselineSegmentToCenterline,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  normalizeBuildingModel,
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

describe('wall dimensions commands', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('translateWall only X moves both endpoints on X', () => {
    const floor = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const w = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall: w }).ok).toBe(true);
    const id = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    const r = useEditorStore.getState().applyCommand({
      type: 'translateWall',
      wallId: id,
      dxMm: 500,
      dyMm: 999,
      axis: 'x',
    });
    expect(r.ok).toBe(true);
    const nw = useEditorStore.getState().document.draftModel!.walls[0]!;
    expect(nw.start.x).toBe(500);
    expect(nw.end.x).toBe(1500);
    expect(nw.start.y).toBe(0);
    expect(nw.end.y).toBe(0);
  });

  it('numeric length via updateWall changes end along axis', () => {
    const floor = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    const model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const w = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thicknessMm: 200,
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall: w }).ok).toBe(true);
    const id = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    expect(
      useEditorStore.getState().applyCommand({
        type: 'updateWall',
        wallId: id,
        patch: { end: { x: 7300, y: 0 } },
      }).ok
    ).toBe(true);
    const nw = useEditorStore.getState().document.draftModel!.walls[0]!;
    expect(nw.end.x).toBe(7300);
    const roundtrip = normalizeBuildingModel(JSON.parse(JSON.stringify(useEditorStore.getState().document.draftModel)) as unknown);
    expect(roundtrip.walls[0]!.end.x).toBe(7300);
  });

  it('baseline inside/outside дают разный оффсет центральной линии относительно кликов', () => {
    const t = 200;
    const a = { x: 0, y: 0 };
    const b = { x: 7300, y: 0 };
    const ins = baselineSegmentToCenterline(a, b, t, 'inside');
    const out = baselineSegmentToCenterline(a, b, t, 'outside');
    expect(ins.start.y).not.toBe(out.start.y);
    expect(Math.abs(ins.start.y - out.start.y)).toBe(t);
  });
});
