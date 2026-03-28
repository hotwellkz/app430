import type { BuildingModel, WallPanelLayoutResult } from '@2wix/shared-types';

export function upsertWallPanelLayout(model: BuildingModel, layout: WallPanelLayoutResult): BuildingModel {
  return {
    ...model,
    wallPanelLayouts: {
      ...(model.wallPanelLayouts ?? {}),
      [layout.wallId]: layout,
    },
  };
}

export function clearWallPanelLayout(model: BuildingModel, wallId: string): BuildingModel {
  const cur = model.wallPanelLayouts;
  if (!cur || !(wallId in cur)) return model;
  const { [wallId]: _, ...rest } = cur;
  return {
    ...model,
    wallPanelLayouts: Object.keys(rest).length > 0 ? rest : undefined,
  };
}

export function mergeWallPanelLayouts(
  model: BuildingModel,
  layouts: Record<string, WallPanelLayoutResult>
): BuildingModel {
  return {
    ...model,
    wallPanelLayouts: {
      ...(model.wallPanelLayouts ?? {}),
      ...layouts,
    },
  };
}

/** Удалить сохранённые раскладки всех стен этажа. */
export function clearWallPanelLayoutsForFloor(model: BuildingModel, floorId: string): BuildingModel {
  const cur = model.wallPanelLayouts;
  if (!cur) return model;
  const wallIds = new Set(model.walls.filter((w) => w.floorId === floorId).map((w) => w.id));
  let changed = false;
  const next: Record<string, WallPanelLayoutResult> = { ...cur };
  for (const id of Object.keys(cur)) {
    if (wallIds.has(id)) {
      delete next[id];
      changed = true;
    }
  }
  if (!changed) return model;
  return {
    ...model,
    wallPanelLayouts: Object.keys(next).length > 0 ? next : undefined,
  };
}

/** Пометить сохранённые раскладки как устаревшие после правки геометрии стены или проёмов. */
export function markWallPanelLayoutsStaleForWallIds(
  model: BuildingModel,
  wallIds: string[]
): BuildingModel {
  if (wallIds.length === 0) return model;
  const cur = model.wallPanelLayouts;
  if (!cur) return model;
  const idSet = new Set(wallIds);
  let changed = false;
  const next: Record<string, WallPanelLayoutResult> = { ...cur };
  for (const wid of idSet) {
    const layout = next[wid];
    if (layout && layout.stale !== true) {
      next[wid] = { ...layout, stale: true };
      changed = true;
    }
  }
  if (!changed) return model;
  return { ...model, wallPanelLayouts: next };
}
