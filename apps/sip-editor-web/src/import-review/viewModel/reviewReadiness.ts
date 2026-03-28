import type {
  ArchitecturalImportSnapshot,
  ImportRequiredDecision,
  ImportUserDecisionSet,
} from '@2wix/shared-types';
import { getInternalWallCandidatesFromSnapshot } from '../utils/internalWallCandidates';

/**
 * Локальная копия правил backend `computeReviewReadiness` (importJobService),
 * чтобы кнопки и подсказки совпадали с сервером до POST.
 */
export function computeImportReviewReadiness(
  snapshot: ArchitecturalImportSnapshot,
  decisions: ImportUserDecisionSet
): {
  missingRequiredDecisions: ImportRequiredDecision[];
  remainingBlockingIssueIds: string[];
  isReadyToApply: boolean;
} {
  const missing: ImportRequiredDecision[] = [];
  const floorIds = snapshot.floors.map((f) => f.id);
  const heightsMap = decisions.floorHeightsMmByFloorId ?? {};
  const heightsComplete = floorIds.every((id) => typeof heightsMap[id] === 'number');
  if (!heightsComplete) {
    missing.push({
      code: 'FLOOR_HEIGHTS_REQUIRED',
      message: 'Нужно заполнить heights для всех этажей',
      satisfied: false,
    });
  }

  if (snapshot.roofHints && !decisions.roofTypeConfirmed) {
    missing.push({
      code: 'ROOF_TYPE_CONFIRMATION_REQUIRED',
      message: 'Нужно подтвердить тип крыши',
      satisfied: false,
    });
  }

  if (decisions.internalBearingWalls?.confirmed === undefined) {
    missing.push({
      code: 'INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED',
      message: 'Нужно подтвердить внутренние несущие стены',
      satisfied: false,
    });
  } else if (decisions.internalBearingWalls.confirmed === true) {
    const candidates = getInternalWallCandidatesFromSnapshot(snapshot);
    const allowed = new Set(candidates.map((w) => w.id));
    const selected = (decisions.internalBearingWalls.wallIds ?? []).filter((id) => allowed.has(id));
    if (candidates.length > 0 && selected.length === 0) {
      missing.push({
        code: 'INTERNAL_BEARING_WALL_IDS_REQUIRED',
        message: 'Выберите хотя бы одну стену',
        satisfied: false,
      });
    }
  }

  if (!decisions.scale?.mode) {
    missing.push({
      code: 'SCALE_DECISION_REQUIRED',
      message: 'Нужно подтвердить или переопределить масштаб',
      satisfied: false,
    });
  }
  if (
    decisions.scale?.mode === 'override' &&
    !(typeof decisions.scale.mmPerPixel === 'number' && decisions.scale.mmPerPixel > 0)
  ) {
    missing.push({
      code: 'SCALE_OVERRIDE_VALUE_REQUIRED',
      message: 'Для scale override нужно указать mmPerPixel',
      satisfied: false,
    });
  }

  const blockingIssueIds = snapshot.unresolved
    .filter((u) => u.severity === 'blocking')
    .map((u) => u.id);
  const resolvedIssueIds = new Set((decisions.issueResolutions ?? []).map((x) => x.issueId));
  const remainingBlocking = blockingIssueIds.filter((id) => !resolvedIssueIds.has(id));
  if (remainingBlocking.length > 0) {
    missing.push({
      code: 'BLOCKING_ISSUES_RESOLUTION_REQUIRED',
      message: 'Нужно явно разрешить все blocking issues',
      satisfied: false,
    });
  }

  return {
    missingRequiredDecisions: missing,
    remainingBlockingIssueIds: remainingBlocking,
    isReadyToApply: missing.length === 0,
  };
}
