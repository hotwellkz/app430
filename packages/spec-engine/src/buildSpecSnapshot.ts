import type { BuildingModel } from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type {
  RoofSpecSummary,
  SlabSpecSummary,
  SpecItem,
  SpecSnapshot,
  SpecSourceType,
  SourceSpecSummary,
  WallSpecSummary,
} from './types.js';

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
      sourceTypeSet: Set<SpecSourceType>;
      trimmedCount: number;
    }
  >();

  const sourceGrouped = new Map<
    string,
    {
      sourceType: SpecSourceType;
      sourceId: string;
      floorId: string;
      panelCount: number;
      trimmedCount: number;
      totalAreaM2: number;
      byType: Map<string, { panelCount: number; trimmedCount: number; totalAreaM2: number }>;
    }
  >();

  const warningCountBySource = new Map<string, number>();
  for (const w of panelization.warnings) {
    for (const id of w.relatedObjectIds) {
      warningCountBySource.set(id, (warningCountBySource.get(id) ?? 0) + 1);
    }
  }

  const totalsBySourceType: Record<SpecSourceType, { panels: number; trimmedPanels: number; areaM2: number }> = {
    wall: { panels: 0, trimmedPanels: 0, areaM2: 0 },
    slab: { panels: 0, trimmedPanels: 0, areaM2: 0 },
    roof: { panels: 0, trimmedPanels: 0, areaM2: 0 },
  };

  let totalTrimmed = 0;
  let totalArea = 0;

  for (const panel of panelization.generatedPanels) {
    const sourceType = panel.sourceType as SpecSourceType;
    const pt = panelTypeById.get(panel.panelTypeId);
    const code = pt?.code ?? panel.panelTypeId;
    const name = pt?.name ?? panel.panelTypeId;
    const areaM2 = (panel.widthMm * panel.heightMm) / 1_000_000;
    totalArea += areaM2;
    totalsBySourceType[sourceType].panels += 1;
    totalsBySourceType[sourceType].areaM2 += areaM2;
    if (panel.trimmed) {
      totalTrimmed += 1;
      totalsBySourceType[sourceType].trimmedPanels += 1;
    }

    const gKey = panel.panelTypeId;
    const g = grouped.get(gKey) ?? {
      panelTypeId: panel.panelTypeId,
      code,
      name,
      panelCount: 0,
      areaM2: 0,
      sourceIds: new Set<string>(),
      sourceTypeSet: new Set<SpecSourceType>(),
      trimmedCount: 0,
    };
    g.panelCount += 1;
    g.areaM2 += areaM2;
    g.sourceIds.add(panel.sourceId);
    g.sourceTypeSet.add(sourceType);
    if (panel.trimmed) g.trimmedCount += 1;
    grouped.set(gKey, g);

    const key = `${sourceType}:${panel.sourceId}`;
    const groupedSource = sourceGrouped.get(key) ?? {
      sourceType,
      sourceId: panel.sourceId,
      floorId: panel.floorId,
      panelCount: 0,
      trimmedCount: 0,
      totalAreaM2: 0,
      byType: new Map<string, { panelCount: number; trimmedCount: number; totalAreaM2: number }>(),
    };
    groupedSource.panelCount += 1;
    groupedSource.totalAreaM2 += areaM2;
    if (panel.trimmed) groupedSource.trimmedCount += 1;
    const byType = groupedSource.byType.get(panel.panelTypeId) ?? {
      panelCount: 0,
      trimmedCount: 0,
      totalAreaM2: 0,
    };
    byType.panelCount += 1;
    byType.totalAreaM2 += areaM2;
    if (panel.trimmed) byType.trimmedCount += 1;
    groupedSource.byType.set(panel.panelTypeId, byType);
    sourceGrouped.set(key, groupedSource);
  }

  const items: SpecItem[] = [];
  for (const [typeId, g] of grouped.entries()) {
    const sourceType: SpecItem['sourceType'] =
      g.sourceTypeSet.size === 1
        ? [...g.sourceTypeSet][0]!
        : 'mixed';
    items.push({
      id: `item-panels-${typeId}`,
      code: g.code,
      name: `${g.name} — панели`,
      unit: 'pcs',
      qty: g.panelCount,
      totalAreaM2: round2(g.areaM2),
      sourceType,
      sourceIds: [...g.sourceIds],
      formula: 'qty = count(generatedPanels)',
      category: 'sip-panels',
      meta: { trimmedCount: g.trimmedCount },
    });
    items.push({
      id: `item-area-${typeId}`,
      code: `${g.code}-AREA`,
      name: `${g.name} — площадь`,
      unit: 'm2',
      qty: round2(g.areaM2),
      totalAreaM2: round2(g.areaM2),
      sourceType,
      sourceIds: [...g.sourceIds],
      formula: 'm2 = sum(widthMm*heightMm/1_000_000)',
      category: 'sip-panels',
      meta: { panelCount: g.panelCount },
    });
  }

  function toSourceSummary(s: {
    sourceType: SpecSourceType;
    sourceId: string;
    floorId: string;
    panelCount: number;
    trimmedCount: number;
    totalAreaM2: number;
    byType: Map<string, { panelCount: number; trimmedCount: number; totalAreaM2: number }>;
  }): SourceSpecSummary {
    return {
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      floorId: s.floorId,
      panelCount: s.panelCount,
      trimmedCount: s.trimmedCount,
      totalAreaM2: round2(s.totalAreaM2),
      warningsCount: warningCountBySource.get(s.sourceId) ?? 0,
      panelTypeBreakdown: [...s.byType.entries()].map(([panelTypeId, v]) => {
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
    };
  }

  const wallSummaries: WallSpecSummary[] = [...sourceGrouped.values()]
    .filter((s) => s.sourceType === 'wall')
    .map((s) => {
      const base = toSourceSummary(s);
      return { ...base, sourceType: 'wall', wallId: s.sourceId };
    });
  const slabSummaries: SlabSpecSummary[] = [...sourceGrouped.values()]
    .filter((s) => s.sourceType === 'slab')
    .map((s) => {
      const base = toSourceSummary(s);
      return { ...base, sourceType: 'slab', slabId: s.sourceId };
    });
  const roofSummaries: RoofSpecSummary[] = [...sourceGrouped.values()]
    .filter((s) => s.sourceType === 'roof')
    .map((s) => {
      const base = toSourceSummary(s);
      return { ...base, sourceType: 'roof', roofId: s.sourceId };
    });

  return {
    items,
    summary: {
      totalPanels: panelization.generatedPanels.length,
      totalTrimmedPanels: totalTrimmed,
      totalPanelAreaM2: round2(totalArea),
      wallCountIncluded: wallSummaries.length,
      slabCountIncluded: slabSummaries.length,
      roofCountIncluded: roofSummaries.length,
      warningCount: panelization.warnings.length,
      totalsBySourceType: {
        wall: {
          panels: totalsBySourceType.wall.panels,
          trimmedPanels: totalsBySourceType.wall.trimmedPanels,
          areaM2: round2(totalsBySourceType.wall.areaM2),
        },
        slab: {
          panels: totalsBySourceType.slab.panels,
          trimmedPanels: totalsBySourceType.slab.trimmedPanels,
          areaM2: round2(totalsBySourceType.slab.areaM2),
        },
        roof: {
          panels: totalsBySourceType.roof.panels,
          trimmedPanels: totalsBySourceType.roof.trimmedPanels,
          areaM2: round2(totalsBySourceType.roof.areaM2),
        },
      },
    },
    wallSummaries,
    slabSummaries,
    roofSummaries,
    warnings: panelization.warnings,
    generatedAt: new Date().toISOString(),
  };
}
