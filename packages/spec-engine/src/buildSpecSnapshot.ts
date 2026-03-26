import type { BuildingModel } from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type { SpecItem, SpecSnapshot, WallSpecSummary } from './types.js';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildSpecSnapshot(
  model: BuildingModel,
  panelization: PanelizationResult
): SpecSnapshot {
  const panelTypeById = new Map(model.panelLibrary.map((p) => [p.id, p]));

  const grouped = new Map<
    string,
    {
      panelTypeId: string;
      code: string;
      name: string;
      panelCount: number;
      areaM2: number;
      sourceIds: Set<string>;
    }
  >();

  const wallGrouped = new Map<
    string,
    {
      wallId: string;
      floorId: string;
      panelCount: number;
      trimmedCount: number;
      totalAreaM2: number;
      byType: Map<string, { panelCount: number; trimmedCount: number; totalAreaM2: number }>;
    }
  >();

  let totalTrimmed = 0;
  let totalArea = 0;

  for (const panel of panelization.generatedPanels) {
    const pt = panelTypeById.get(panel.panelTypeId);
    const code = pt?.code ?? panel.panelTypeId;
    const name = pt?.name ?? panel.panelTypeId;
    const areaM2 = (panel.widthMm * panel.heightMm) / 1_000_000;
    totalArea += areaM2;
    if (panel.trimmed) totalTrimmed += 1;

    const gKey = panel.panelTypeId;
    const g = grouped.get(gKey) ?? {
      panelTypeId: panel.panelTypeId,
      code,
      name,
      panelCount: 0,
      areaM2: 0,
      sourceIds: new Set<string>(),
    };
    g.panelCount += 1;
    g.areaM2 += areaM2;
    g.sourceIds.add(panel.sourceId);
    grouped.set(gKey, g);

    const w = wallGrouped.get(panel.sourceId) ?? {
      wallId: panel.sourceId,
      floorId: panel.floorId,
      panelCount: 0,
      trimmedCount: 0,
      totalAreaM2: 0,
      byType: new Map<string, { panelCount: number; trimmedCount: number; totalAreaM2: number }>(),
    };
    w.panelCount += 1;
    w.totalAreaM2 += areaM2;
    if (panel.trimmed) w.trimmedCount += 1;
    const byType = w.byType.get(panel.panelTypeId) ?? { panelCount: 0, trimmedCount: 0, totalAreaM2: 0 };
    byType.panelCount += 1;
    byType.totalAreaM2 += areaM2;
    if (panel.trimmed) byType.trimmedCount += 1;
    w.byType.set(panel.panelTypeId, byType);
    wallGrouped.set(panel.sourceId, w);
  }

  const items: SpecItem[] = [];
  for (const [typeId, g] of grouped.entries()) {
    items.push({
      id: `item-panels-${typeId}`,
      code: g.code,
      name: `${g.name} — панели`,
      unit: 'pcs',
      qty: g.panelCount,
      sourceType: 'wall_panel',
      sourceIds: [...g.sourceIds],
      formula: 'qty = count(generatedPanels)',
      category: 'wall-panels',
    });
    items.push({
      id: `item-area-${typeId}`,
      code: `${g.code}-AREA`,
      name: `${g.name} — площадь`,
      unit: 'm2',
      qty: round2(g.areaM2),
      sourceType: 'wall_panel',
      sourceIds: [...g.sourceIds],
      formula: 'm2 = sum(widthMm*heightMm/1_000_000)',
      category: 'wall-panels',
    });
  }

  const wallSummaries: WallSpecSummary[] = [...wallGrouped.values()].map((w) => ({
    wallId: w.wallId,
    floorId: w.floorId,
    panelCount: w.panelCount,
    trimmedCount: w.trimmedCount,
    totalAreaM2: round2(w.totalAreaM2),
    panelTypeBreakdown: [...w.byType.entries()].map(([panelTypeId, v]) => {
      const pt = panelTypeById.get(panelTypeId);
      return {
        panelTypeId,
        code: pt?.code ?? panelTypeId,
        name: pt?.name ?? panelTypeId,
        panelCount: v.panelCount,
        trimmedCount: v.trimmedCount,
        totalAreaM2: round2(v.totalAreaM2),
      };
    }),
  }));

  return {
    items,
    summary: {
      totalPanels: panelization.generatedPanels.length,
      totalTrimmedPanels: totalTrimmed,
      totalPanelAreaM2: round2(totalArea),
      wallCountIncluded: wallSummaries.length,
      warningCount: panelization.warnings.length,
    },
    wallSummaries,
    warnings: panelization.warnings,
    generatedAt: new Date().toISOString(),
  };
}
