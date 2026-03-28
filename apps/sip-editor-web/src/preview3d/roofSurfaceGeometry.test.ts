import { describe, expect, it } from 'vitest';
import type { Roof } from '@2wix/shared-types';
import { buildRoofSurfacePositionsMeters } from './roofSurfaceGeometry';

describe('buildRoofSurfacePositionsMeters', () => {
  it('строит треугольники для двускатной крыши с eavesContourMm', () => {
    const roof: Roof = {
      id: 'r1',
      floorId: 'f1',
      roofType: 'gable',
      slopeDegrees: 30,
      ridgeDirection: 'x',
      overhangMm: 400,
      baseElevationMm: 3000,
      generationMode: 'auto',
      eavesContourMm: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
    };
    const pos = buildRoofSurfacePositionsMeters(roof);
    expect(pos).not.toBeNull();
    expect(pos!.length % 9).toBe(0);
    expect(pos!.length).toBeGreaterThan(0);
  });

  it('возвращает null без eavesContourMm', () => {
    const roof: Roof = {
      id: 'r1',
      floorId: 'f1',
      roofType: 'gable',
      slopeDegrees: 30,
      overhangMm: 400,
      baseElevationMm: 3000,
      generationMode: 'auto',
    };
    expect(buildRoofSurfacePositionsMeters(roof)).toBeNull();
  });
});
