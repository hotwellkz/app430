import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';

function makeVersion(model: ReturnType<typeof createEmptyBuildingModel>): ProjectVersion {
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

describe('panelization derived snapshot', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  function init() {
    const model = createEmptyBuildingModel();
    const floor = createFloor({
      label: '1 этаж',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    model.floors.push(floor);
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 3100, y: 0 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      })
    );
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(model),
    });
    return model.walls[0]!.id;
  }

  it('recalculates when panelDirection changes', () => {
    const wallId = init();
    const a = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId,
      patch: { panelDirection: 'horizontal' },
    });
    const b = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    expect(a.generatedPanels.length).toBeGreaterThan(0);
    expect(b.generatedPanels.length).toBeGreaterThan(0);
    expect(a.generatedPanels[0]?.orientation).not.toBe(b.generatedPanels[0]?.orientation);
  });

  it('recalculates when toggling panelizationEnabled', () => {
    const wallId = init();
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId,
      patch: { panelizationEnabled: false },
    });
    const a = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId,
      patch: { panelizationEnabled: true, structuralRole: 'bearing' },
    });
    const b = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    expect(a.generatedPanels.length).toBeLessThan(b.generatedPanels.length);
  });

  it('recalculates when global panel settings change', () => {
    const wallId = init();
    useEditorStore.getState().applyCommand({ type: 'updateWall', wallId, patch: { panelDirection: 'vertical' } });
    useEditorStore.getState().applyCommand({ type: 'updatePanelSettings', patch: { minTrimWidthMm: 100 } });
    const a = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    useEditorStore.getState().applyCommand({ type: 'updatePanelSettings', patch: { minTrimWidthMm: 600 } });
    const b = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    expect(b.warnings.length).toBeGreaterThanOrEqual(a.warnings.length);
  });

  it('discard resets snapshot to server model', () => {
    const wallId = init();
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId,
      patch: { panelizationEnabled: false },
    });
    const changed = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    useEditorStore.getState().discardDraft();
    const reset = buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!);
    expect(changed.generatedPanels.length).toBeLessThan(reset.generatedPanels.length);
  });
});
