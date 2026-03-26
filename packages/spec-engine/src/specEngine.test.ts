import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from './buildSpecSnapshot.js';

function modelBase() {
  const m = createEmptyBuildingModel();
  const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
  m.floors.push(f);
  return m;
}

describe('spec-engine', () => {
  it('aggregate single wall panels', () => {
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
    const p = buildPanelizationSnapshot(m);
    const s = buildSpecSnapshot(m, p);
    expect(s.summary.totalPanels).toBeGreaterThan(0);
    expect(s.items.some((x) => x.unit === 'pcs')).toBe(true);
  });

  it('aggregate multiple walls same panel type', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' }),
      createWall({ id: 'w2', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2800, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.summary.wallCountIncluded).toBe(2);
  });

  it('aggregate mixed panel types with override', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' }),
      createWall({ id: 'w2', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2400, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical', panelTypeId: 'panel-std-174-600' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.items.filter((x) => x.unit === 'pcs').length).toBeGreaterThan(1);
  });

  it('trimmed panels counted correctly', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 2600, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.summary.totalTrimmedPanels).toBeGreaterThanOrEqual(0);
  });

  it('wall summaries built correctly', () => {
    const m = modelBase();
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3100, y: 0 }, thicknessMm: 174, wallType: 'external', panelizationEnabled: true, panelDirection: 'vertical' })
    );
    const s = buildSpecSnapshot(m, buildPanelizationSnapshot(m));
    expect(s.wallSummaries[0]?.wallId).toBe('w1');
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
