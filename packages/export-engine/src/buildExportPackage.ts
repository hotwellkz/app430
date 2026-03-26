import type { BuildingModel } from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type { SpecSnapshot } from '@2wix/spec-engine';
import { buildCommercialSnapshot } from '@2wix/commercial-engine';
import type { BuildExportPackageOptions, ExportPackageSnapshot, ExportTables } from './types.js';

export function buildExportPackage(
  model: BuildingModel,
  panelization: PanelizationResult,
  spec: SpecSnapshot,
  options: BuildExportPackageOptions
): ExportPackageSnapshot {
  const commercial =
    options.presentationMode === 'commercial'
      ? buildCommercialSnapshot(spec, {
          basedOnVersionId: options.version.id,
          presentationMode: 'commercial',
        })
      : null;
  const warningCountByWall = new Map<string, number>();
  for (const w of panelization.warnings) {
    for (const id of w.relatedObjectIds) {
      warningCountByWall.set(id, (warningCountByWall.get(id) ?? 0) + 1);
    }
  }
  return {
    presentationMode: options.presentationMode ?? 'technical',
    projectSummary: {
      projectId: model.meta.projectId ?? '',
      projectTitle: options.projectTitle,
      versionId: options.version.id,
      versionNumber: options.version.versionNumber,
      generatedBy: options.createdBy,
      floorsCount: model.floors.length,
    },
    wallSummaries: spec.wallSummaries.map((w) => ({
      wallId: w.wallId,
      floorId: w.floorId,
      panelCount: w.panelCount,
      trimmedCount: w.trimmedCount,
      totalAreaM2: w.totalAreaM2,
      warningCount: warningCountByWall.get(w.wallId) ?? 0,
    })),
    slabSummaries: spec.slabSummaries.map((s) => ({
      slabId: s.slabId,
      floorId: s.floorId,
      panelCount: s.panelCount,
      trimmedCount: s.trimmedCount,
      totalAreaM2: s.totalAreaM2,
      warningCount: warningCountByWall.get(s.slabId) ?? 0,
    })),
    roofSummaries: spec.roofSummaries.map((r) => ({
      roofId: r.roofId,
      floorId: r.floorId,
      panelCount: r.panelCount,
      trimmedCount: r.trimmedCount,
      totalAreaM2: r.totalAreaM2,
      warningCount: warningCountByWall.get(r.roofId) ?? 0,
    })),
    panelizationSummary: panelization.stats,
    specSummary: spec.summary,
    aggregatedSpecItems: spec.items.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      unit: x.unit,
      qty: x.qty,
      category: x.category,
      sourceIds: x.sourceIds,
    })),
    commercialSections:
      commercial?.sections.map((s) => ({
            id: s.id,
            code: s.code,
            title: s.title,
            sourceTypes: s.sourceTypes,
            itemCount: s.itemCount,
            totalQty: s.totalQty,
            totalAreaM2: s.totalAreaM2,
            warningCount: s.warningCount,
          })),
    commercialItems:
      commercial?.groupedItems.map((x) => ({
            id: x.id,
            code: x.code,
            name: x.name,
            unit: x.unit,
            qty: x.qty,
            totalAreaM2: x.totalAreaM2,
            sourceTypes: x.sourceTypes,
            sourceIds: x.sourceIds,
            panelTypeIds: x.panelTypeIds,
            costKey: x.costKey,
            category: x.category,
            group: x.group,
          })),
    warnings: panelization.warnings,
    panelSettings: model.panelSettings,
    generatedAt: new Date().toISOString(),
    basedOnVersionId: options.version.id,
  };
}

export function buildExportTables(snapshot: ExportPackageSnapshot): ExportTables {
  const mode = snapshot.presentationMode ?? 'technical';
  const summaryRows = [
    { metric: 'presentationMode', value: mode },
    { metric: 'projectTitle', value: snapshot.projectSummary.projectTitle },
    { metric: 'versionNumber', value: snapshot.projectSummary.versionNumber },
    { metric: 'floorsCount', value: snapshot.projectSummary.floorsCount },
    { metric: 'totalPanels', value: snapshot.specSummary.totalPanels },
    { metric: 'trimmedPanels', value: snapshot.specSummary.totalTrimmedPanels },
    { metric: 'totalAreaM2', value: snapshot.specSummary.totalPanelAreaM2 },
    { metric: 'warnings', value: snapshot.warnings.length },
  ];
  const bomRows = snapshot.aggregatedSpecItems.map((i) => ({
    code: i.code,
    name: i.name,
    unit: i.unit,
    qty: i.qty,
    category: i.category ?? '',
    sourceIds: i.sourceIds.join(';'),
  }));
  const commercialRows = (snapshot.commercialItems ?? []).map((i) => ({
    code: i.code,
    name: i.name,
    unit: i.unit,
    qty: i.qty,
    totalAreaM2: i.totalAreaM2 ?? '',
    sourceTypes: i.sourceTypes.join(';'),
    costKey: i.costKey ?? '',
    category: i.category ?? '',
    group: i.group ?? '',
  }));
  const sectionRows = (snapshot.commercialSections ?? []).map((s) => ({
    code: s.code,
    title: s.title,
    sourceTypes: s.sourceTypes.join(';'),
    itemCount: s.itemCount,
    totalQty: s.totalQty,
    totalAreaM2: s.totalAreaM2,
    warningCount: s.warningCount,
  }));
  const wallRows = snapshot.wallSummaries.map((w) => ({
    wallId: w.wallId,
    floorId: w.floorId,
    panelCount: w.panelCount,
    trimmedCount: w.trimmedCount,
    totalAreaM2: w.totalAreaM2,
    warningCount: w.warningCount,
  }));
  const slabRows = (snapshot.slabSummaries ?? []).map((s) => ({
    slabId: s.slabId,
    floorId: s.floorId,
    panelCount: s.panelCount,
    trimmedCount: s.trimmedCount,
    totalAreaM2: s.totalAreaM2,
    warningCount: s.warningCount,
  }));
  const roofRows = (snapshot.roofSummaries ?? []).map((r) => ({
    roofId: r.roofId,
    floorId: r.floorId,
    panelCount: r.panelCount,
    trimmedCount: r.trimmedCount,
    totalAreaM2: r.totalAreaM2,
    warningCount: r.warningCount,
  }));
  const warningRows = snapshot.warnings.map((w) => ({
    severity: w.severity,
    code: w.code,
    message: w.message,
    relatedObjectIds: w.relatedObjectIds.join(';'),
  }));
  return { presentationMode: mode, summaryRows, bomRows, commercialRows, sectionRows, wallRows, slabRows, roofRows, warningRows };
}
