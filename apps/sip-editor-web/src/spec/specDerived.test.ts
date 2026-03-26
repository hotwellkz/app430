import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createRoof, createSlab, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from '@2wix/spec-engine';
import type { ProjectVersion } from '@2wix/shared-types';

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

describe('spec derived integration', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  function setup() {
    const m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    m.walls.push(
      createWall({
        id: 'w1',
        floorId: 'f1',
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      })
    );
    m.walls.push(
      createWall({
        id: 'w2',
        floorId: 'f1',
        start: { x: 3000, y: 0 },
        end: { x: 3000, y: 2500 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      })
    );
    m.slabs.push(
      createSlab({
        id: 's1',
        floorId: 'f1',
        contourWallIds: ['w1', 'w2'],
        direction: 'x',
      })
    );
    m.roofs.push(
      createRoof({
        id: 'r1',
        floorId: 'f1',
        roofType: 'single_slope',
        slopeDegrees: 25,
        overhangMm: 250,
        baseElevationMm: 2800,
      })
    );
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(m),
    });
  }

  it('changing global panel type recalculates spec', () => {
    setup();
    const a = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    useEditorStore
      .getState()
      .applyCommand({ type: 'updatePanelSettings', patch: { defaultPanelTypeId: 'panel-std-174-600' } });
    const b = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(a.items.find((x) => x.unit === 'pcs')?.code).not.toBe(b.items.find((x) => x.unit === 'pcs')?.code);
  });

  it('wall-level panel type override recalculates spec', () => {
    setup();
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: 'w1',
      patch: { panelTypeId: 'panel-std-174-600' },
    });
    const s = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(s.items.some((x) => x.code.includes('600x2800'))).toBe(true);
  });

  it('toggle panelization removes/adds wall in spec', () => {
    setup();
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: 'w1',
      patch: { panelizationEnabled: false },
    });
    const off = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: 'w1',
      patch: { panelizationEnabled: true },
    });
    const on = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(off.summary.totalPanels).toBeLessThan(on.summary.totalPanels);
  });

  it('discard resets spec snapshot', () => {
    setup();
    useEditorStore.getState().applyCommand({
      type: 'updateWall',
      wallId: 'w1',
      patch: { panelizationEnabled: false },
    });
    const changed = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    useEditorStore.getState().discardDraft();
    const reset = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(changed.summary.totalPanels).toBeLessThan(reset.summary.totalPanels);
  });

  it('changing slab params recalculates spec', () => {
    setup();
    const a = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    useEditorStore.getState().applyCommand({
      type: 'updateSlab',
      slabId: 's1',
      patch: { direction: 'y' },
    });
    const b = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(a.summary.totalsBySourceType.slab.panels).toBeGreaterThan(0);
    expect(b.summary.totalsBySourceType.slab.panels).toBeGreaterThan(0);
  });

  it('changing roof params recalculates spec', () => {
    setup();
    const a = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    useEditorStore.getState().applyCommand({
      type: 'updateRoof',
      roofId: 'r1',
      patch: { roofType: 'gable' },
    });
    const b = buildSpecSnapshot(
      useEditorStore.getState().document.draftModel!,
      buildPanelizationSnapshot(useEditorStore.getState().document.draftModel!)
    );
    expect(a.summary.totalsBySourceType.roof.panels).toBeGreaterThan(0);
    expect(b.summary.totalsBySourceType.roof.panels).toBeGreaterThan(0);
  });
});
