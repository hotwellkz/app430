import type { ArchitecturalImportSnapshot, ImportUserDecisionSet } from '@2wix/shared-types';
import type { ImportWizardFormValues } from './importWizardTypes';

/**
 * Маппинг ответов мастера в partial decisions для saveImportJobReview
 * (после того как snapshot уже есть на job).
 */
export function mapWizardToReviewDecisions(
  snapshot: ArchitecturalImportSnapshot,
  wizard: ImportWizardFormValues
): Partial<ImportUserDecisionSet> {
  const floors = snapshot.floors ?? [];
  const floorHeightsMmByFloorId: Record<string, number> = {};

  const h1 = Math.round(wizard.floor1HeightMm);
  if (floors[0]) floorHeightsMmByFloorId[floors[0].id] = h1;
  if (wizard.floorCount === 2 && floors[1]) {
    floorHeightsMmByFloorId[floors[1].id] = Math.round(wizard.floor2HeightMm);
  }

  const roofTypeConfirmed =
    wizard.roof === 'unknown' ? ('unknown' as const) : wizard.roof === 'gabled' ? 'gabled' : 'single-slope';

  let scale: ImportUserDecisionSet['scale'];
  if (wizard.scale === 'exact') {
    const mm = Number(wizard.mmPerPixel);
    if (Number.isFinite(mm) && mm > 0) {
      scale = { mode: 'override', mmPerPixel: mm };
    } else {
      scale = { mode: 'confirmed' };
    }
  } else {
    scale = { mode: 'confirmed' };
  }

  /** Только явное «нет» — фиксируем в decisions; иначе пользователь заполняет в review. */
  let internalBearingWalls: ImportUserDecisionSet['internalBearingWalls'];
  if (wizard.internalBearing === 'none') {
    internalBearingWalls = { confirmed: false };
  } else {
    internalBearingWalls = undefined;
  }

  return {
    floorHeightsMmByFloorId,
    roofTypeConfirmed,
    scale,
    ...(internalBearingWalls !== undefined ? { internalBearingWalls } : {}),
  };
}
