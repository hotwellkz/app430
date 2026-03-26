import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';
import { buildSpecSnapshot } from '@2wix/spec-engine';
import { buildExportPackage, buildExportTables } from './buildExportPackage.js';

describe('export-engine', () => {
  it('builds export package with version metadata and warnings', () => {
    const model = createEmptyBuildingModel();
    model.floors.push(createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 }));
    model.walls.push(
      createWall({
        id: 'w1',
        floorId: 'f1',
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
        thicknessMm: 174,
        wallType: 'external',
        panelizationEnabled: true,
        panelDirection: 'vertical',
      })
    );
    const panelization = buildPanelizationSnapshot(model);
    const spec = buildSpecSnapshot(model, panelization);
    const snapshot = buildExportPackage(model, panelization, spec, {
      projectTitle: 'Test project',
      version: { id: 'v1', versionNumber: 3 },
      createdBy: 'u1',
    });
    expect(snapshot.projectSummary.versionId).toBe('v1');
    expect(snapshot.specSummary.totalPanels).toBeGreaterThan(0);
  });

  it('builds unified table structure for csv/xlsx/pdf', () => {
    const model = createEmptyBuildingModel();
    const panelization = buildPanelizationSnapshot(model);
    const spec = buildSpecSnapshot(model, panelization);
    const snapshot = buildExportPackage(model, panelization, spec, {
      projectTitle: 'Empty',
      version: { id: 'v1', versionNumber: 1 },
      createdBy: null,
    });
    const tables = buildExportTables(snapshot);
    expect(Array.isArray(tables.summaryRows)).toBe(true);
    expect(Array.isArray(tables.bomRows)).toBe(true);
    expect(Array.isArray(tables.wallRows)).toBe(true);
    expect(Array.isArray(tables.warningRows)).toBe(true);
  });
});
