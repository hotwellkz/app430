import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createRoof, createSlab, createWall } from '@2wix/domain-model';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from '@2wix/spec-engine';
import { buildCommercialSnapshot } from './buildCommercialSnapshot.js';

describe('commercial-engine', () => {
  it('builds commercial snapshot from expanded spec', () => {
    const m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    m.walls.push(
      createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174, panelizationEnabled: true, panelDirection: 'vertical' }),
      createWall({ id: 'w2', floorId: 'f1', start: { x: 3000, y: 0 }, end: { x: 3000, y: 2000 }, thicknessMm: 174, panelizationEnabled: true, panelDirection: 'vertical' })
    );
    m.slabs.push(createSlab({ id: 's1', floorId: 'f1', contourWallIds: ['w1', 'w2'], direction: 'x' }));
    m.roofs.push(createRoof({ id: 'r1', floorId: 'f1', roofType: 'single_slope', slopeDegrees: 25, overhangMm: 200, baseElevationMm: 2800 }));
    const p = buildPanelizationSnapshot(m);
    const s = buildSpecSnapshot(m, p);
    const c = buildCommercialSnapshot(s, { basedOnVersionId: 'v1' });
    expect(c.summary.totalPanels).toBeGreaterThan(0);
    expect(c.sections.length).toBe(3);
    expect(c.groupedItems.length).toBeGreaterThan(0);
    expect(c.groupedItems[0]?.costKey.startsWith('CK-')).toBe(true);
  });
});
