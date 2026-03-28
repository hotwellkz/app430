import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  addFloorToModel,
  buildOpeningOnWallClick,
  createEmptyBuildingModel,
  createFloor,
  createWall,
  isWallPanelLayoutOutdated,
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

describe('opening workflow (store + undo)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  function setupWall() {
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
      end: { x: 10000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall: w }).ok).toBe(true);
    return { floor, wallId: useEditorStore.getState().document.draftModel!.walls[0]!.id };
  }

  it('addOpening → updateOpening → deleteOpening', () => {
    const { floor, wallId } = setupWall();
    const draft = useEditorStore.getState().document.draftModel!;
    const built = buildOpeningOnWallClick(draft, wallId, { x: 5000, y: 0 }, 'window');
    if ('ok' in built && built.ok === false) throw new Error(built.reason);
    expect(
      useEditorStore.getState().applyCommand({ type: 'addOpening', opening: built as import('@2wix/shared-types').Opening })
        .ok
    ).toBe(true);
    const oid = useEditorStore.getState().document.draftModel!.openings[0]!.id;
    expect(
      useEditorStore.getState().applyCommand({
        type: 'updateOpening',
        openingId: oid,
        patch: { widthMm: 1400 },
      }).ok
    ).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.openings[0]!.widthMm).toBe(1400);
    expect(useEditorStore.getState().applyCommand({ type: 'deleteOpening', openingId: oid }).ok).toBe(true);
    expect(useEditorStore.getState().document.draftModel!.openings).toHaveLength(0);
  });

  it('undo после addOpening восстанавливает модель', () => {
    setupWall();
    const draft = useEditorStore.getState().document.draftModel!;
    const wallId = draft.walls[0]!.id;
    const built = buildOpeningOnWallClick(draft, wallId, { x: 2000, y: 0 }, 'door');
    if ('ok' in built && built.ok === false) throw new Error(built.reason);
    expect(useEditorStore.getState().applyCommand({ type: 'addOpening', opening: built as import('@2wix/shared-types').Opening }).ok).toBe(
      true
    );
    expect(useEditorStore.getState().document.draftModel!.openings).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.draftModel!.openings).toHaveLength(0);
  });

  it('panel layout помечается устаревшей после addOpening до пересчёта', () => {
    const floor = createFloor({ label: '1', level: 1, elevationMm: 0, sortIndex: 0 });
    let model = addFloorToModel(createEmptyBuildingModel(), floor);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(model),
    });
    const w = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 10000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    expect(useEditorStore.getState().applyCommand({ type: 'addWall', wall: w }).ok).toBe(true);
    const wallId = useEditorStore.getState().document.draftModel!.walls[0]!.id;
    expect(useEditorStore.getState().applyCommand({ type: 'calculateWallPanelLayout', wallId }).ok).toBe(true);
    let draft = useEditorStore.getState().document.draftModel!;
    expect(draft.wallPanelLayouts?.[wallId]).toBeDefined();
    expect(isWallPanelLayoutOutdated(draft, wallId)).toBe(false);

    const built = buildOpeningOnWallClick(draft, wallId, { x: 5000, y: 0 }, 'window');
    if ('ok' in built && built.ok === false) throw new Error(built.reason);
    expect(
      useEditorStore.getState().applyCommand({ type: 'addOpening', opening: built as import('@2wix/shared-types').Opening })
        .ok
    ).toBe(true);
    draft = useEditorStore.getState().document.draftModel!;
    expect(draft.wallPanelLayouts?.[wallId]?.stale).toBe(true);
    expect(isWallPanelLayoutOutdated(draft, wallId)).toBe(true);
    expect(useEditorStore.getState().applyCommand({ type: 'calculateWallPanelLayout', wallId }).ok).toBe(true);
    draft = useEditorStore.getState().document.draftModel!;
    expect(draft.wallPanelLayouts?.[wallId]?.stale).not.toBe(true);
    expect(isWallPanelLayoutOutdated(draft, wallId)).toBe(false);
  });

  it('save/load: normalize сохраняет openings', () => {
    const { wallId } = setupWall();
    const d0 = useEditorStore.getState().document.draftModel!;
    const built = buildOpeningOnWallClick(d0, wallId, { x: 4000, y: 0 }, 'portal');
    if ('ok' in built && built.ok === false) throw new Error(built.reason);
    useEditorStore.getState().applyCommand({ type: 'addOpening', opening: built as import('@2wix/shared-types').Opening });
    const m = useEditorStore.getState().document.draftModel!;
    const n = normalizeBuildingModel(JSON.parse(JSON.stringify(m)) as unknown);
    expect(n.openings).toHaveLength(1);
    expect(n.openings[0]!.openingType).toBe('portal');
  });
});
