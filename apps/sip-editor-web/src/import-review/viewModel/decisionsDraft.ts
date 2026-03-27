import type {
  ArchitecturalImportSnapshot,
  ImportIssueResolutionAction,
  ImportUserDecisionSet,
} from '@2wix/shared-types';
import { getInternalWallCandidatesFromSnapshot } from '../utils/internalWallCandidates';
import type { RequiredDecisionFieldViewModel } from './importReviewViewModel.types';

export function initialDecisionsFromJob(job: { review?: { decisions?: ImportUserDecisionSet } }): ImportUserDecisionSet {
  const prev = job.review?.decisions ?? {};
  return {
    ...prev,
    floorHeightsMmByFloorId: { ...(prev.floorHeightsMmByFloorId ?? {}) },
    issueResolutions: prev.issueResolutions ? [...prev.issueResolutions] : undefined,
  };
}

export type InternalBearingWallsInteractionPayload =
  | { kind: 'setMode'; mode: 'yes' | 'no' | '' }
  | { kind: 'toggleWall'; wallId: string };

export function applyInternalBearingWallsInteraction(
  decisions: ImportUserDecisionSet,
  snapshot: ArchitecturalImportSnapshot,
  payload: InternalBearingWallsInteractionPayload
): ImportUserDecisionSet {
  const next: ImportUserDecisionSet = {
    ...decisions,
    floorHeightsMmByFloorId: { ...(decisions.floorHeightsMmByFloorId ?? {}) },
    issueResolutions: decisions.issueResolutions ? [...decisions.issueResolutions] : [],
  };

  const candidates = getInternalWallCandidatesFromSnapshot(snapshot);
  const allowed = new Set(candidates.map((w) => w.id));

  if (payload.kind === 'setMode') {
    if (payload.mode === '' || payload.mode === undefined) {
      delete next.internalBearingWalls;
      return next;
    }
    if (payload.mode === 'no') {
      next.internalBearingWalls = { confirmed: false, wallIds: [] };
      return next;
    }
    const prevIds = decisions.internalBearingWalls?.wallIds ?? [];
    const filtered = prevIds.filter((id) => allowed.has(id));
    next.internalBearingWalls = { confirmed: true, wallIds: filtered };
    return next;
  }

  if (payload.kind === 'toggleWall') {
    if (!allowed.has(payload.wallId)) return next;
    const cur = next.internalBearingWalls ?? { confirmed: true, wallIds: [] };
    if (!cur.confirmed) {
      next.internalBearingWalls = { confirmed: true, wallIds: [payload.wallId] };
      return next;
    }
    const set = new Set(cur.wallIds ?? []);
    if (set.has(payload.wallId)) set.delete(payload.wallId);
    else set.add(payload.wallId);
    next.internalBearingWalls = { confirmed: true, wallIds: [...set] };
    return next;
  }

  return next;
}

export function applyFieldToDecisions(
  decisions: ImportUserDecisionSet,
  field: RequiredDecisionFieldViewModel,
  raw: string | number | boolean
): ImportUserDecisionSet {
  const next: ImportUserDecisionSet = {
    ...decisions,
    floorHeightsMmByFloorId: { ...(decisions.floorHeightsMmByFloorId ?? {}) },
    issueResolutions: decisions.issueResolutions ? [...decisions.issueResolutions] : [],
  };

  if (field.controlType === 'floorHeightMm' && field.floorId) {
    if (raw === '' || raw === null || raw === undefined) {
      delete next.floorHeightsMmByFloorId![field.floorId];
    } else {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        delete next.floorHeightsMmByFloorId![field.floorId];
      } else {
        next.floorHeightsMmByFloorId![field.floorId] = Math.round(n);
      }
    }
    return next;
  }

  if (field.key === 'roofType') {
    if (!raw || raw === '') {
      delete next.roofTypeConfirmed;
    } else {
      next.roofTypeConfirmed = raw as ImportUserDecisionSet['roofTypeConfirmed'];
    }
    return next;
  }

  if (field.key === 'scaleMode') {
    if (!raw || raw === '') {
      delete next.scale;
    } else {
      const mode = raw as 'confirmed' | 'override';
      next.scale = {
        mode,
        mmPerPixel: mode === 'override' ? (decisions.scale?.mmPerPixel ?? null) : null,
      };
    }
    return next;
  }

  if (field.key === 'scaleMmPerPixel') {
    const mode = next.scale?.mode ?? decisions.scale?.mode;
    if (!mode) return next;
    const n = typeof raw === 'number' ? raw : Number(raw);
    next.scale = {
      mode,
      mmPerPixel: Number.isFinite(n) && n > 0 ? n : null,
    };
    return next;
  }

  if (field.controlType === 'issueResolution' && field.issueId) {
    const action = typeof raw === 'string' ? raw : String(raw);
    const list = next.issueResolutions ?? [];
    const idx = list.findIndex((x) => x.issueId === field.issueId);
    if (!action) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) {
      list[idx] = { ...list[idx], action: action as ImportIssueResolutionAction };
    } else {
      list.push({ issueId: field.issueId, action: action as ImportIssueResolutionAction });
    }
    next.issueResolutions = list;
    return next;
  }

  return next;
}
