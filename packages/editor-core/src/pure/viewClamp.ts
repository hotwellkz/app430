import type { BuildingModel } from '@2wix/shared-types';
import { getFloorsSorted } from '@2wix/domain-model';
import type { ViewState } from '../types/state.js';

export const EDITOR_VIEW_MIN_ZOOM = 0.02;
export const EDITOR_VIEW_MAX_ZOOM = 8;

/** Если activeFloorId нет в модели — первый этаж по sortIndex или null. */
export function clampActiveFloorToModel(view: ViewState, draft: BuildingModel): ViewState {
  const id = view.activeFloorId;
  if (id != null && draft.floors.some((f) => f.id === id)) {
    return view;
  }
  const first = getFloorsSorted(draft)[0]?.id ?? null;
  return { ...view, activeFloorId: first };
}

export function clampEditorZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return EDITOR_VIEW_MIN_ZOOM;
  return Math.min(EDITOR_VIEW_MAX_ZOOM, Math.max(EDITOR_VIEW_MIN_ZOOM, zoom));
}
