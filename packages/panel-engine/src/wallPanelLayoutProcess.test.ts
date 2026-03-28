import { describe, expect, it } from 'vitest';
import {
  createEmptyBuildingModel,
  createFloor,
  createWall,
  normalizeBuildingModel,
} from '@2wix/domain-model';
import {
  batchComputeWallPanelLayoutsForFloor,
  computeWallPanelLayoutForWall,
  isWallEligibleForPanelization,
} from './wallPanelLayoutProcess.js';

function baseModel() {
  const m = createEmptyBuildingModel();
  const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
  m.floors.push(f);
  return m;
}

describe('computeWallPanelLayoutForWall', () => {
  it('exact fit: wall length divides by panel width (vertical)', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    const r = computeWallPanelLayoutForWall(m, 'w1');
    expect(r).not.toBeNull();
    expect(r!.layoutResult.panels.length).toBe(4);
    expect(r!.layoutResult.panels.every((p) => !p.trimmed)).toBe(true);
    expect(r!.layoutResult.summary.remainderMm).toBe(0);
  });

  it('trim last panel when length not divisible', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 3200, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    const r = computeWallPanelLayoutForWall(m, 'w1');
    expect(r).not.toBeNull();
    const trimmed = r!.layoutResult.panels.filter((p) => p.trimmed);
    expect(trimmed.length).toBeGreaterThanOrEqual(1);
  });

  it('ineligible internal partition returns failed layout', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      thicknessMm: 100,
      wallType: 'internal',
      structuralRole: 'partition',
      panelizationEnabled: true,
      panelDirection: 'vertical',
    });
    m.walls.push(w);
    expect(isWallEligibleForPanelization(w).eligible).toBe(false);
    const r = computeWallPanelLayoutForWall(m, 'w1');
    expect(r!.layoutResult.status).toBe('failed');
    expect(r!.layoutResult.panels.length).toBe(0);
  });

  it('horizontal direction yields partial status with warning', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'horizontal',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    const r = computeWallPanelLayoutForWall(m, 'w1');
    expect(r!.layoutResult.direction).toBe('horizontal');
    expect(r!.layoutResult.warnings.some((x) => x.code === 'PANEL_LAYOUT_PARTIAL')).toBe(true);
    expect(r!.layoutResult.status === 'partial' || r!.layoutResult.status === 'ok').toBe(true);
  });

  it('recalculate after wall length change changes panel count', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    const before = computeWallPanelLayoutForWall(m, 'w1')!;
    const m2 = {
      ...m,
      walls: m.walls.map((x) =>
        x.id === 'w1' ? { ...x, end: { x: 2500, y: 0 } } : x
      ),
    };
    const after = computeWallPanelLayoutForWall(m2, 'w1')!;
    expect(before.layoutResult.panels.length).not.toBe(after.layoutResult.panels.length);
  });

  it('single opening: partial layout, opening-aware warnings, geometry signature', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    m.openings.push({
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      positionAlongWall: 2500,
      widthMm: 1200,
      heightMm: 1500,
      bottomOffsetMm: 800,
      openingType: 'window',
    });
    const r = computeWallPanelLayoutForWall(m, 'w1')!;
    expect(r.layoutResult.status).toBe('partial');
    expect(r.layoutResult.summary.panelizationStatus).toBe('partial');
    expect(r.layoutResult.summary.openingsCount).toBe(1);
    expect(r.layoutResult.geometrySignature).toBeTruthy();
    expect(r.layoutResult.warnings.map((x) => x.code)).toContain('WALL_HAS_OPENINGS');
    expect(r.layoutResult.warnings.map((x) => x.code)).toContain('OPENING_SPLIT_APPLIED');
  });

  it('multiple openings: MULTIPLE_OPENINGS_COMPLEX_LAYOUT', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 8000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    m.openings.push(
      {
        id: 'o1',
        floorId: 'f1',
        wallId: 'w1',
        positionAlongWall: 2000,
        widthMm: 900,
        heightMm: 2100,
        bottomOffsetMm: 0,
        openingType: 'door',
      },
      {
        id: 'o2',
        floorId: 'f1',
        wallId: 'w1',
        positionAlongWall: 5500,
        widthMm: 1200,
        heightMm: 1500,
        bottomOffsetMm: 900,
        openingType: 'window',
      }
    );
    const r = computeWallPanelLayoutForWall(m, 'w1')!;
    expect(r.layoutResult.warnings.map((x) => x.code)).toContain('MULTIPLE_OPENINGS_COMPLEX_LAYOUT');
  });

  it('batch summary counts eligible walls', () => {
    const m = baseModel();
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
        panelTypeId: 'panel-std-174',
      }),
      createWall({
        id: 'w2',
        floorId: 'f1',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 3000 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
        panelTypeId: 'panel-std-174',
      })
    );
    const { summary, layouts } = batchComputeWallPanelLayoutsForFloor(m, 'f1');
    expect(summary.eligibleWalls).toBe(2);
    expect(Object.keys(layouts).length).toBe(2);
  });
});

describe('normalizeBuildingModel wallPanelLayouts', () => {
  it('roundtrips wallPanelLayouts', () => {
    const m = baseModel();
    const w = createWall({
      id: 'w1',
      floorId: 'f1',
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      thicknessMm: 174,
      wallType: 'external',
      panelizationEnabled: true,
      panelDirection: 'vertical',
      panelTypeId: 'panel-std-174',
    });
    m.walls.push(w);
    const r = computeWallPanelLayoutForWall(m, 'w1')!;
    const withLayout = { ...m, wallPanelLayouts: { w1: r.layoutResult } };
    const raw = JSON.parse(JSON.stringify(withLayout));
    const n = normalizeBuildingModel(raw);
    expect(n.wallPanelLayouts?.w1?.wallId).toBe('w1');
    expect(n.wallPanelLayouts?.w1?.panels.length).toBe(r.layoutResult.panels.length);
  });
});
