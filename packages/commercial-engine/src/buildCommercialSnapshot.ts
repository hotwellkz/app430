import type { SpecSnapshot, SpecSourceType } from '@2wix/spec-engine';
import type { BuildCommercialSnapshotOptions, CommercialItem, CommercialSection, CommercialSnapshot } from './types.js';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

const TITLES: Record<SpecSourceType, string> = {
  wall: 'Walls',
  slab: 'Slabs',
  roof: 'Roof',
};

function stableCostKey(sourceType: SpecSourceType, code: string): string {
  return `CK-${sourceType.toUpperCase()}-${code}`;
}

export function buildCommercialSnapshot(
  spec: SpecSnapshot,
  options: BuildCommercialSnapshotOptions = {}
): CommercialSnapshot {
  const bySourceType = new Map<SpecSourceType, CommercialItem[]>();
  bySourceType.set('wall', []);
  bySourceType.set('slab', []);
  bySourceType.set('roof', []);

  const groupedItems: CommercialItem[] = spec.items
    .filter((x) => x.unit === 'pcs')
    .map((x) => {
      const srcTypes: SpecSourceType[] =
        x.sourceType === 'mixed' ? ['wall', 'slab', 'roof'] : [x.sourceType];
      return {
        id: `comm-${x.id}`,
        code: x.code,
        name: x.name,
        unit: x.unit,
        qty: x.qty,
        totalAreaM2: x.totalAreaM2,
        sourceTypes: srcTypes,
        sourceIds: x.sourceIds,
        panelTypeIds: [x.code],
        costKey: stableCostKey(srcTypes[0]!, x.code),
        category: x.category ?? 'sip-panels',
        group: srcTypes.join('+'),
      };
    });

  for (const item of groupedItems) {
    for (const st of item.sourceTypes) {
      bySourceType.get(st)!.push(item);
    }
  }

  const sections: CommercialSection[] = (['wall', 'slab', 'roof'] as SpecSourceType[]).map((sourceType) => {
    const items = bySourceType.get(sourceType) ?? [];
    const sourceIds =
      sourceType === 'wall'
        ? spec.wallSummaries.map((x) => x.wallId)
        : sourceType === 'slab'
          ? spec.slabSummaries.map((x) => x.slabId)
          : spec.roofSummaries.map((x) => x.roofId);
    const warningCount = spec.warnings.filter((w) => w.relatedObjectIds.some((id) => sourceIds.includes(id))).length;
    return {
      id: `section-${sourceType}`,
      code: sourceType.toUpperCase(),
      title: TITLES[sourceType],
      sourceTypes: [sourceType],
      itemCount: items.length,
      totalQty: round2(items.reduce((acc, x) => acc + x.qty, 0)),
      totalAreaM2: round2(items.reduce((acc, x) => acc + (x.totalAreaM2 ?? 0), 0)),
      warningCount,
      items,
    };
  });

  const warningMap = new Map<string, number>();
  for (const w of spec.warnings) {
    warningMap.set(w.code, (warningMap.get(w.code) ?? 0) + 1);
  }

  return {
    summary: {
      totalPanels: spec.summary.totalPanels,
      totalAreaM2: spec.summary.totalPanelAreaM2,
      totalSections: sections.length,
      warningCount: spec.summary.warningCount,
      totalsBySourceType: spec.summary.totalsBySourceType,
    },
    sections,
    groupedItems,
    warningsSummary: [...warningMap.entries()].map(([code, count]) => ({ code, count })),
    basedOnVersionId: options.basedOnVersionId,
    generatedAt: new Date().toISOString(),
    presentationMode: options.presentationMode ?? 'commercial',
  };
}
