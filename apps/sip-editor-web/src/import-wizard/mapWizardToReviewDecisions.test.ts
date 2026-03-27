import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { describe, expect, it } from 'vitest';
import { defaultImportWizardForm } from './importWizardTypes';
import { mapWizardToReviewDecisions } from './mapWizardToReviewDecisions';

function snapshotTwoFloors(): ArchitecturalImportSnapshot {
  return {
    projectMeta: {},
    floors: [{ id: 'f1' }, { id: 'f2' }],
    walls: [],
    openings: [],
    stairs: [],
    unresolved: [],
    notes: [],
  };
}

describe('mapWizardToReviewDecisions', () => {
  it('maps floor heights to snapshot floor ids', () => {
    const snap = snapshotTwoFloors();
    const form = {
      ...defaultImportWizardForm(),
      floorCount: 2 as const,
      floor1HeightMm: 3000,
      floor2HeightMm: 2600,
    };
    const d = mapWizardToReviewDecisions(snap, form);
    expect(d.floorHeightsMmByFloorId?.f1).toBe(3000);
    expect(d.floorHeightsMmByFloorId?.f2).toBe(2600);
  });

  it('sets internalBearingWalls only for none', () => {
    const snap = snapshotTwoFloors();
    const none = mapWizardToReviewDecisions(snap, { ...defaultImportWizardForm(), internalBearing: 'none' });
    expect(none.internalBearingWalls).toEqual({ confirmed: false });

    const review = mapWizardToReviewDecisions(snap, {
      ...defaultImportWizardForm(),
      internalBearing: 'confirm_in_review',
    });
    expect(review.internalBearingWalls).toBeUndefined();

    const unsure = mapWizardToReviewDecisions(snap, {
      ...defaultImportWizardForm(),
      internalBearing: 'unsure',
    });
    expect(unsure.internalBearingWalls).toBeUndefined();
  });

  it('maps roof and scale', () => {
    const snap = snapshotTwoFloors();
    const form = {
      ...defaultImportWizardForm(),
      roof: 'gabled' as const,
      scale: 'exact' as const,
      mmPerPixel: 2.5,
    };
    const d = mapWizardToReviewDecisions(snap, form);
    expect(d.roofTypeConfirmed).toBe('gabled');
    expect(d.scale).toEqual({ mode: 'override', mmPerPixel: 2.5 });
  });
});
