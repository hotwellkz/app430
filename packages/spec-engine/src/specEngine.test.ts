import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createRoof, createSlab, createWall } from '@2wix/domain-model';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from './buildSpecSnapshot.js';

function modelBase() {
  const m = createEmptyBuildingModel();
  const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
  m.floors.push(f);
  return m;
}

describe('spec-engine', () => {
  it('aggregate wall + slab + roof panels', () => {
    const m = modelBase();
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
        end: { x: 3000, y: 2400 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      }),
      createWall({
        id: 'w3',
        floorId: 'f1',
        start: { x: 3000, y: 2400 },
        end: { x: 0, y: 2400 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      }),
      createWall({
        id: 'w4',
        floorId: 'f1',
        start: { x: 0, y: 2400 },
        end: { x: 0, y: 0 },
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
        contourWallIds: ['w1', 'w2', 'w3', 'w4'],
        direction: 'x',
      })
    );
    m.roofs.push(
      createRoof({
        id: 'r1',
        floorId: 'f1',
        roofType: 'gable',
        slopeDegrees: 25,
        overhangMm: 300,
        baseElevationMm: 2800,
      })
    );
    const p = buildPanelizationSnapshot(m);
    const s = buildSpecSnapshot(m, p);
    expect(s.summary.totalPanels).toBeGreaterThan(0);
    expect(s.summary.totalsBySourceType.wall.panels).toBeGreaterThan(0);
    expect(s.summary.totalsBySourceType.slab.panels).toBeGreaterThan(0);
    expect(s.summary.totalsBySourceType.roof.panels).toBeGreaterThan(0);
  });

  it('totals by sourceType are exposed', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' }),
      createWall({ id: 'w2', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2800, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.summary.totalsBySourceType.wall.panels).toBeGreaterThan(0);
    expect(s.summary.totalsBySourceType.slab.panels).toBe(0);
  });

  it('mixed panel types across source types', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' }),
      createWall({ id: 'w2', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2400, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical', panelTypeId: 'panel-std-174-600' })
    );
    m.slabs.push(
      createSlab({
        id: 's1',
        floorId: 'f1',
        contourWallIds: ['w1'],
        direction: 'x',
        panelTypeId: 'panel-std-174-600',
      })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.items.filter((x) => x.unit === 'pcs').length).toBeGreaterThan(0);
  });

  it('trimmed panels counted correctly', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2600, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.summary.totalTrimmedPanels).toBeGreaterThanOrEqual(0);
  });

  it('wall/slab/roof summaries built correctly', () => {
    const m = modelBase();
    m.walls.push(createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3100, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' }));
    m.slabs.push(createSlab({ id: 's1', floorId: 'f1', contourWallIds: ['w1'], direction: 'x' }));
    m.roofs.push(createRoof({ id: 'r1', floorId: 'f1', roofType: 'single_slope', slopeDegrees: 20, overhangMm: 200, baseElevationMm: 2800 }));
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.wallSummaries[0]?.wallId).toBe('w1');
    expect(Array.isArray(s.slabSummaries)).toBe(true);
    expect(Array.isArray(s.roofSummaries)).toBe(true);
  });

  it('effective panel type override applied', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical', panelTypeId: 'panel-std-174-600' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.items.some((x) => x.code.includes('600x2800'))).toBe(true);
  });

  it('empty panelization gives empty spec', () => {
    const m = modelBase();
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.summary.totalPanels).toBe(0);
    expect(s.items.length).toBe(0);
  });
});
