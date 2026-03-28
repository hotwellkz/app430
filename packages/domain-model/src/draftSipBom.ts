import type {
  BuildingModel,
  DraftSipBomFloorAggregate,
  DraftSipBomSnapshot,
  DraftSipBomByPanelTypeRow,
  WallPanelLayoutResult,
} from '@2wix/shared-types';
import { computeWallPanelizationGeometrySignature } from './wallPanelLayoutGeometry.js';
import { getWallById } from './modelUtils.js';

const DISCLAIMER =
  'Черновая спецификация по сохранённым раскладкам SIP. Не для производства без проверки инженера. Проёмы и partial-layout могут занижать точность.';

function panelAreaM2(seg: WallPanelLayoutResult['panels'][number]): number {
  return (seg.lengthAlongWallMm * seg.heightMm) / 1_000_000;
}

function resolvePanelTypeMeta(model: BuildingModel, panelTypeId: string) {
  const pt = model.panelLibrary.find((p) => p.id === panelTypeId);
  return {
    code: pt?.code ?? panelTypeId,
    name: pt?.name ?? panelTypeId,
    thicknessMm: pt?.thicknessMm ?? 0,
  };
}

/**
 * Сравнение подписи геометрии: устарело, если явный stale или подпись не совпадает / отсутствует (legacy).
 */
export function isWallPanelLayoutOutdated(model: BuildingModel, wallId: string): boolean {
  const layout = model.wallPanelLayouts?.[wallId];
  if (!layout) return false;
  if (layout.stale === true) return true;
  const current = computeWallPanelizationGeometrySignature(model, wallId);
  if (!layout.geometrySignature) return true;
  return layout.geometrySignature !== current;
}

export function buildDraftSipBomSnapshot(model: BuildingModel): DraftSipBomSnapshot {
  const layouts = model.wallPanelLayouts ?? {};
  const byPanelTypeMap = new Map<
    string,
    { panelCount: number; trimCount: number; totalAreaM2: number; meta: ReturnType<typeof resolvePanelTypeMeta> }
  >();

  const floorAgg = new Map<
    string,
    {
      wallsWithLayout: number;
      sipPanelsTotal: number;
      trimPanelsTotal: number;
      wallsReady: number;
      wallsPartial: number;
      wallsInvalid: number;
      staleLayouts: number;
      warningsTotal: number;
    }
  >();

  let projWallsWithLayout = 0;
  let projSipPanels = 0;
  let projTrim = 0;
  let projReady = 0;
  let projPartial = 0;
  let projInvalid = 0;
  let projStale = 0;
  let projWarnings = 0;

  for (const wallId of Object.keys(layouts)) {
    const layout = layouts[wallId]!;
    const wall = getWallById(model, wallId);
    if (!wall) continue;

    const floorId = layout.floorId || wall.floorId;
    const outdated = isWallPanelLayoutOutdated(model, wallId);
    const ui = layout.summary.panelizationStatus;
    const warnCount = layout.warnings?.length ?? 0;
    projWarnings += warnCount;

    if (!floorAgg.has(floorId)) {
      floorAgg.set(floorId, {
        wallsWithLayout: 0,
        sipPanelsTotal: 0,
        trimPanelsTotal: 0,
        wallsReady: 0,
        wallsPartial: 0,
        wallsInvalid: 0,
        staleLayouts: 0,
        warningsTotal: 0,
      });
    }
    const fa = floorAgg.get(floorId)!;
    fa.wallsWithLayout += 1;
    fa.warningsTotal += warnCount;
    if (outdated) {
      fa.staleLayouts += 1;
      projStale += 1;
    }
    if (ui === 'ready') {
      fa.wallsReady += 1;
      projReady += 1;
    } else if (ui === 'partial') {
      fa.wallsPartial += 1;
      projPartial += 1;
    } else {
      fa.wallsInvalid += 1;
      projInvalid += 1;
    }

    projWallsWithLayout += 1;
    const trimCount = layout.summary.trimPanelCount;
    fa.trimPanelsTotal += trimCount;
    projTrim += trimCount;

    const pid = layout.panelTypeId;
    const meta = resolvePanelTypeMeta(model, pid);
    let row = byPanelTypeMap.get(pid);
    if (!row) {
      row = { panelCount: 0, trimCount: 0, totalAreaM2: 0, meta };
      byPanelTypeMap.set(pid, row);
    }
    row.trimCount += trimCount;

    for (const seg of layout.panels) {
      row.panelCount += 1;
      row.totalAreaM2 += panelAreaM2(seg);
      fa.sipPanelsTotal += 1;
      projSipPanels += 1;
    }
  }

  const byPanelType: DraftSipBomByPanelTypeRow[] = Array.from(byPanelTypeMap.entries()).map(
    ([panelTypeId, v]) => ({
      panelTypeId,
      code: v.meta.code,
      name: v.meta.name,
      thicknessMm: v.meta.thicknessMm,
      panelCount: v.panelCount,
      trimCount: v.trimCount,
      totalAreaM2: Math.round(v.totalAreaM2 * 1000) / 1000,
    })
  );

  const byFloor: DraftSipBomFloorAggregate[] = Array.from(floorAgg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([floorId, v]) => ({
      floorId,
      wallsWithLayout: v.wallsWithLayout,
      sipPanelsTotal: v.sipPanelsTotal,
      trimPanelsTotal: v.trimPanelsTotal,
      wallsReady: v.wallsReady,
      wallsPartial: v.wallsPartial,
      wallsInvalid: v.wallsInvalid,
      staleLayouts: v.staleLayouts,
      warningsTotal: v.warningsTotal,
    }));

  return {
    kind: 'draft_sip_bom_v1',
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    project: {
      wallsWithLayout: projWallsWithLayout,
      sipPanelsTotal: projSipPanels,
      trimPanelsTotal: projTrim,
      wallsReady: projReady,
      wallsPartial: projPartial,
      wallsInvalid: projInvalid,
      staleLayouts: projStale,
      warningsTotal: projWarnings,
    },
    byPanelType,
    byFloor,
  };
}
