import { describe, expect, it } from 'vitest';
import {
  buildFoundationAndScreedForFloor,
  createEmptyBuildingModel,
  createFloor,
  createOpening,
  createSlab,
  createWall,
  upsertFoundationInModel,
} from '@2wix/domain-model';
import type { Roof } from '@2wix/shared-types';
import { buildPreviewSceneModel } from './buildPreviewSceneModel';

function baseModel() {
  const model = createEmptyBuildingModel();
  const floor = createFloor({
    label: '1 этаж',
    level: 1,
    elevationMm: 0,
    heightMm: 3000,
    floorType: 'full',
    sortIndex: 0,
  });
  model.floors.push(floor);
  return { model, floor };
}

describe('buildPreviewSceneModel', () => {
  it('учитывает inherited высоту стены', () => {
    const { model, floor } = baseModel();
    const wall = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    model.walls.push(wall);

    const scene = buildPreviewSceneModel(model, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: true, openings: false, slabs: false, roof: false },
    });

    expect(scene.walls.length).toBeGreaterThan(0);
    expect(scene.walls[0]!.size.y).toBeCloseTo(3, 3);
  });

  it('делит стену на сегменты при одном проеме', () => {
    const { model, floor } = baseModel();
    const wall = createWall({
      floorId: floor.id,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    model.walls.push(wall);
    model.openings.push(
      createOpening({
        floorId: floor.id,
        wallId: wall.id,
        positionAlongWall: 2500,
        widthMm: 1200,
        heightMm: 1400,
        bottomOffsetMm: 900,
        openingType: 'window',
      })
    );

    const scene = buildPreviewSceneModel(model, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: true, openings: true, slabs: false, roof: false },
    });

    expect(scene.walls.length).toBeGreaterThanOrEqual(3);
    expect(scene.openings.length).toBe(1);
  });

  it('строит roof для single_slope и gable', () => {
    const { model, floor } = baseModel();
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 4000, y: 0 },
        end: { x: 4000, y: 3000 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );

    const roofSingle: Roof = {
      id: 'roof-single',
      floorId: floor.id,
      roofType: 'single_slope',
      slopeDegrees: 30,
      ridgeDirection: 'x',
      overhangMm: 400,
      baseElevationMm: 3000,
      generationMode: 'auto',
    };
    const roofGable: Roof = { ...roofSingle, id: 'roof-gable', roofType: 'gable' };

    model.roofs = [roofSingle];
    const single = buildPreviewSceneModel(model, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: false, openings: false, slabs: false, roof: true },
    });
    expect(single.roof.length).toBe(1);

    model.roofs = [roofGable];
    const gable = buildPreviewSceneModel(model, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: false, openings: false, slabs: false, roof: true },
    });
    expect(gable.roof.length).toBe(2);
  });

  it('генерирует slabs preview', () => {
    const { model, floor } = baseModel();
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    model.slabs.push(
      createSlab({
        floorId: floor.id,
        slabType: 'interfloor',
        contourWallIds: [],
        direction: 'x',
        generationMode: 'auto',
      })
    );

    const scene = buildPreviewSceneModel(model, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: false, openings: false, slabs: true, roof: false },
    });
    expect(scene.slabs.length).toBe(1);
  });

  it('строит foundations и groundScreeds в 3D snapshot', () => {
    const { model, floor } = baseModel();
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 5000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 5000, y: 0 },
        end: { x: 5000, y: 5000 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 5000, y: 5000 },
        end: { x: 0, y: 5000 },
        thicknessMm: 200,
        wallType: 'external',
      }),
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 5000 },
        end: { x: 0, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    const built = buildFoundationAndScreedForFloor(model, floor.id);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const withF = upsertFoundationInModel(model, built.foundation, built.screed);
    const scene = buildPreviewSceneModel(withF, {
      activeFloorId: floor.id,
      floorMode: 'all',
      layers: { walls: false, openings: false, slabs: false, roof: false },
    });
    expect(scene.foundations.length).toBeGreaterThan(0);
    expect(scene.groundScreeds.length).toBe(1);
    expect(scene.stats.foundationsRendered).toBeGreaterThan(0);
  });
});
