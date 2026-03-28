import type { WallPlacementMode } from '@2wix/shared-types';

export const EDITOR_LAYER_FOUNDATION = 'foundation';

/** Стяжка / плита нулевого уровня внутри контура фундамента. */
export const EDITOR_LAYER_GROUND_SCREED = 'ground-screed';

/** Перекрытия (плиты) — один логический слой на весь проект (по этажам в модели). */
export const EDITOR_LAYER_SLABS = 'layer-slabs';

/** Крыша — один логический слой. */
export const EDITOR_LAYER_ROOF = 'layer-roof';

/** Слой рисования стен для конкретного этажа (план «Стены N этажа»). */
export function editorLayerFloorWalls(floorId: string): string {
  return `floor-walls:${floorId}`;
}

/** Слой проёмов этажа (окна/двери/проёмы на плане этажа). */
export function editorLayerFloorOpenings(floorId: string): string {
  return `floor-openings:${floorId}`;
}

export function parseFloorWallsLayer(layerId: string | null): string | null {
  if (!layerId || !layerId.startsWith('floor-walls:')) return null;
  return layerId.slice('floor-walls:'.length);
}

export function parseFloorOpeningsLayer(layerId: string | null): string | null {
  if (!layerId || !layerId.startsWith('floor-openings:')) return null;
  return layerId.slice('floor-openings:'.length);
}

/** Этаж, к которому относится слой плана (стены или проёмы), или null. */
export function parseFloorIdFromEditorLayer(layerId: string | null): string | null {
  if (!layerId) return null;
  return parseFloorWallsLayer(layerId) ?? parseFloorOpeningsLayer(layerId);
}

export function isWallDrawingLayer(layerId: string | null): boolean {
  return layerId != null && layerId.startsWith('floor-walls:');
}

export function isFloorOpeningsLayer(layerId: string | null): boolean {
  return layerId != null && layerId.startsWith('floor-openings:');
}

/** Слой относится к плану этажа (стены или проёмы). */
export function isFloorPlanEditorLayer(layerId: string | null): boolean {
  return isWallDrawingLayer(layerId) || isFloorOpeningsLayer(layerId);
}

export function isStructuralEditorLayer(layerId: string | null): boolean {
  if (!layerId) return false;
  return (
    layerId === EDITOR_LAYER_FOUNDATION ||
    layerId === EDITOR_LAYER_GROUND_SCREED ||
    layerId === EDITOR_LAYER_SLABS ||
    layerId === EDITOR_LAYER_ROOF ||
    isFloorPlanEditorLayer(layerId)
  );
}

export function isEditorLayerVisible(
  layerVisibility: Record<string, boolean> | undefined,
  layerKey: string
): boolean {
  if (!layerVisibility || Object.keys(layerVisibility).length === 0) return true;
  return layerVisibility[layerKey] !== false;
}

export function isEditorLayerLocked(
  layerLocked: Record<string, boolean> | undefined,
  layerKey: string
): boolean {
  return layerLocked?.[layerKey] === true;
}

export const DEFAULT_NEW_WALL_PLACEMENT: WallPlacementMode = 'on-axis';
