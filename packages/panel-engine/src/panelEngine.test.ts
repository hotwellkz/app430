import { describe, expect, it } from 'vitest';
import type { BuildingModel, Opening, Wall } from '@2wix/shared-types';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import { buildPanelizationSnapshot } from './buildPanelizationSnapshot.js';

function baseModel(): BuildingModel {
  const model = createEmptyBuildingModel();
  model.floors = [
    {
      id: 'f1',
      label: '1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    },
  ];
  model.panelSettings.defaultPanelTypeId = 'panel-std-174';
  return model;
}

function wall(patch: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    floorId: 'f1',
    start: { x: 0, y: 0 },
    end: { x: 4000, y: 0 },
    thicknessMm: 174,
    wallType: 'external',
    panelizationEnabled: true,
    panelDirection: 'vertical',
    ...patch,
  };
}

function opening(patch: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    floorId: 'f1',
    wallId: 'w1',
    positionAlongWall: 2000,
    widthMm: 1200,
    heightMm: 1400,
    bottomOffsetMm: 900,
    openingType: 'window',
    ...patch,
  };
}

describe('panel-engine wall-first', () => {
  it('simple external wall without openings', () => {
    const model = baseModel();
    model.walls = [wall()];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.length).toBeGreaterThan(0);
    expect(r.wallSummaries[0]?.panelCount).toBe(r.generatedPanels.length);
  });

  it('handles wall with one window', () => {
    const model = baseModel();
    model.walls = [wall()];
    model.openings = [opening()];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.some((p) => p.zoneType === 'above_opening')).toBe(true);
    expect(r.generatedPanels.some((p) => p.zoneType === 'below_opening')).toBe(true);
  });

  it('handles wall with one door', () => {
    const model = baseModel();
    model.walls = [wall()];
    model.openings = [opening({ openingType: 'door', bottomOffsetMm: 0 })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.some((p) => p.zoneType === 'below_opening')).toBe(false);
  });

  it('handles wall with two openings', () => {
    const model = baseModel();
    model.walls = [wall()];
    model.openings = [opening({ id: 'o1', positionAlongWall: 1200 }), opening({ id: 'o2', positionAlongWall: 2900 })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.length).toBeGreaterThan(2);
  });

  it('produces trim warning when trim too small', () => {
    const model = baseModel();
    model.panelSettings.minTrimWidthMm = 500;
    model.walls = [wall({ end: { x: 2600, y: 0 } })];
    const r = buildPanelizationSnapshot(model);
    expect(r.warnings.some((w) => w.code === 'TRIM_TOO_SMALL')).toBe(true);
  });

  it('produces opening too close warnings', () => {
    const model = baseModel();
    model.walls = [wall()];
    model.openings = [opening({ positionAlongWall: 300 })];
    const r = buildPanelizationSnapshot(model);
    expect(r.warnings.some((w) => w.code === 'OPENING_TOO_CLOSE_TO_WALL_START')).toBe(true);
  });

  it('supports horizontal direction', () => {
    const model = baseModel();
    model.walls = [wall({ panelDirection: 'horizontal' })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.every((p) => p.orientation === 'horizontal')).toBe(true);
  });

  it('skips internal non-bearing wall', () => {
    const model = baseModel();
    model.walls = [wall({ wallType: 'internal', structuralRole: 'partition' })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.length).toBe(0);
    expect(r.warnings.some((w) => w.code === 'INTERNAL_WALL_SKIPPED')).toBe(true);
  });

  it('internal bearing + enabled wall is panelized', () => {
    const model = baseModel();
    model.walls = [wall({ wallType: 'internal', structuralRole: 'bearing', panelizationEnabled: true })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.length).toBeGreaterThan(0);
  });

  it('applies wall-level panel type override', () => {
    const model = baseModel();
    model.walls = [wall({ panelTypeId: 'panel-std-174-600' })];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.every((p) => p.panelTypeId === 'panel-std-174-600')).toBe(true);
    expect(r.wallSummaries[0]?.effectivePanelTypeId).toBe('panel-std-174-600');
  });

  it('generates stable labels', () => {
    const model = baseModel();
    model.walls = [wall()];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels[0]?.label.startsWith('W-1-1-')).toBe(true);
  });

  it('builds simple slab layout', () => {
    const model = baseModel();
    model.walls = [
      wall({ id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
      wall({ id: 'w2', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
      wall({ id: 'w3', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
      wall({ id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
    ];
    model.slabs = [
      {
        id: 's1',
        floorId: 'f1',
        slabType: 'interfloor',
        contourWallIds: ['w1', 'w2', 'w3', 'w4'],
        direction: 'x',
        generationMode: 'auto',
      },
    ];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.some((p) => p.sourceType === 'slab')).toBe(true);
    expect(r.slabSummaries[0]?.panelCount).toBeGreaterThan(0);
    expect(r.generatedPanels.some((p) => p.label.startsWith('S-1-1-'))).toBe(true);
  });

  it('builds simple gable roof layout', () => {
    const model = baseModel();
    model.walls = [
      wall({ id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
      wall({ id: 'w2', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
      wall({ id: 'w3', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
      wall({ id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
    ];
    model.roofs = [
      {
        id: 'r1',
        floorId: 'f1',
        roofType: 'gable',
        slopeDegrees: 25,
        ridgeDirection: 'x',
        overhangMm: 300,
        baseElevationMm: 2800,
        generationMode: 'auto',
      },
    ];
    const r = buildPanelizationSnapshot(model);
    expect(r.generatedPanels.some((p) => p.sourceType === 'roof')).toBe(true);
    expect(r.roofSummaries[0]?.panelCount).toBeGreaterThan(0);
    expect(r.generatedPanels.some((p) => p.label.startsWith('R-1-'))).toBe(true);
  });
});
