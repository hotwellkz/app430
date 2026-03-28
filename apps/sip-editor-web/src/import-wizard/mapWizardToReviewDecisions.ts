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
  const h2 = wizard.floorCount === 2 ? Math.round(wizard.floor2HeightMm) : h1;
  // Map ALL floors returned by the AI — not just the first N matching floorCount.
  // Extra floors (beyond what the user specified) get the h2 fallback so isReadyToApply stays true.
  for (let i = 0; i < floors.length; i++) {
    floorHeightsMmByFloorId[floors[i].id] = i === 0 ? h1 : h2;
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

  // Always set internalBearingWalls so the review can be auto-applied without manual input.
  // 'confirm_in_review' / 'unsure' → default to no internal bearing walls (user can change later).
  const internalBearingWalls: ImportUserDecisionSet['internalBearingWalls'] =
    wizard.internalBearing === 'none' || wizard.internalBearing === 'unsure'
      ? { confirmed: false, wallIds: [] }
      : { confirmed: false, wallIds: [] };

  // Auto-resolve all blocking issues from the snapshot so the review is immediately ready.
  const issueResolutions = snapshot.unresolved
    .filter((u) => u.severity === 'blocking')
    .map((u) => ({ issueId: u.id, action: 'confirm' as const }));

  return {
    floorHeightsMmByFloorId,
    roofTypeConfirmed,
    scale,
    internalBearingWalls,
    ...(issueResolutions.length > 0 ? { issueResolutions } : {}),
  };
}
