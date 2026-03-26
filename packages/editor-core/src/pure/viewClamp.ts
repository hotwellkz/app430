export const EDITOR_VIEW_MIN_ZOOM = 0.02;
export const EDITOR_VIEW_MAX_ZOOM = 8;

export function clampEditorZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return EDITOR_VIEW_MIN_ZOOM;
  return Math.min(EDITOR_VIEW_MAX_ZOOM, Math.max(EDITOR_VIEW_MIN_ZOOM, zoom));
}
