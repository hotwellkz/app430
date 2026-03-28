import { describe, expect, it } from 'vitest';
import type { WallPanelLayoutResult } from '@2wix/shared-types';
import { createEmptyBuildingModel } from './buildingProject.js';
import { createFloor } from './floorOps.js';
import { createWall } from './wallOps.js';
import { buildDraftSipBomSnapshot, isWallPanelLayoutOutdated } from './draftSipBom.js';
import { computeWallPanelizationGeometrySignature } from './wallPanelLayoutGeometry.js';
import { upsertWallPanelLayout } from './wallPanelLayoutOps.js';

function minimalLayout(wallId: string, floorId: string, panelTypeId: string): WallPanelLayoutResult {
  return {
    wallId,
    floorId,
    panelTypeId,
    direction: 'vertical',
    computedAt: new Date().toISOString(),
    panels: [
      {
        id: 'p1',
        index: 1,
        lengthAlongWallMm: 1250,
        heightMm: 2800,
        startOffsetMm: 0,
        endOffsetMm: 1250,
        verticalOffsetMm: 0,
        trimmed: false,
        openingAffected: false,
      },
    ],
    warnings: [],
    summary: {
      wallLengthMm: 5000,
      nominalModuleMm: 1250,
      panelCount: 1,
      trimPanelCount: 0,
      remainderMm: 0,
      utilizationRatio: 1,
      openingsCount: 0,
      fullLayoutFraction: 1,
      panelizationStatus: 'ready',
    },
    status: 'ok',
    geometrySignature: 'sig-old',
    stale: false,
  };
}

describe('buildDraftSipBomSnapshot', () => {
  it('aggregates by panel type and floor', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    const w1 = createWall({
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
    m.walls.push(w1);
    let layout = minimalLayout('w1', 'f1', 'panel-std-174');
    layout = { ...layout, geometrySignature: computeWallPanelizationGeometrySignature(m, 'w1') };
    m = upsertWallPanelLayout(m, layout);
    const bom = buildDraftSipBomSnapshot(m);
    expect(bom.project.sipPanelsTotal).toBe(1);
    expect(bom.project.wallsWithLayout).toBe(1);
    expect(bom.byPanelType.some((r) => r.panelTypeId === 'panel-std-174' && r.panelCount === 1)).toBe(true);
    expect(bom.byFloor.length).toBe(1);
    expect(bom.byFloor[0]!.sipPanelsTotal).toBe(1);
  });

  it('legacy layout without geometrySignature counts as outdated', () => {
    let m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    m.walls.push(
      createWall({
        id: 'w1',
        floorId: 'f1',
        start: { x: 0, y: 0 },
        end: { x: 5000, y: 0 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
        panelTypeId: 'panel-std-174',
      })
    );
    const legacy: WallPanelLayoutResult = {
      ...minimalLayout('w1', 'f1', 'panel-std-174'),
      geometrySignature: undefined,
      stale: undefined,
    };
    m = upsertWallPanelLayout(m, legacy);
    expect(isWallPanelLayoutOutdated(m, 'w1')).toBe(true);
    const bom = buildDraftSipBomSnapshot(m);
    expect(bom.project.staleLayouts).toBe(1);
  });
});
