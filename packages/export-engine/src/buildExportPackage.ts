import type { BuildingModel } from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type { SpecSnapshot } from '@2wix/spec-engine';
import type { BuildExportPackageOptions, ExportPackageSnapshot, ExportTables } from './types.js';

export function buildExportPackage(
  model: BuildingModel,
  panelization: PanelizationResult,
  spec: SpecSnapshot,
  options: BuildExportPackageOptions
): ExportPackageSnapshot {
  const warningCountByWall = new Map<string, number>();
  for (const w of panelization.warnings) {
    for (const id of w.relatedObjectIds) {
      warningCountByWall.set(id, (warningCountByWall.get(id) ?? 0) + 1);
    }
  }
  return {
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
    warnings: panelization.warnings,
    panelSettings: model.panelSettings,
    generatedAt: new Date().toISOString(),
    basedOnVersionId: options.version.id,
  };
}

export function buildExportTables(snapshot: ExportPackageSnapshot): ExportTables {
  const summaryRows = [
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
  const wallRows = snapshot.wallSummaries.map((w) => ({
    wallId: w.wallId,
    floorId: w.floorId,
    panelCount: w.panelCount,
    trimmedCount: w.trimmedCount,
    totalAreaM2: w.totalAreaM2,
    warningCount: w.warningCount,
  }));
  const warningRows = snapshot.warnings.map((w) => ({
    severity: w.severity,
    code: w.code,
    message: w.message,
    relatedObjectIds: w.relatedObjectIds.join(';'),
  }));
  return { summaryRows, bomRows, wallRows, warningRows };
}
