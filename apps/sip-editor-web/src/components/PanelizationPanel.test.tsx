import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { PanelizationPanel } from './PanelizationPanel';

function makeVersion(model: ReturnType<typeof createEmptyBuildingModel>): ProjectVersion {
  return {
    id: 'v1',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: model,
    createdAt: new Date().toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  };
}

describe('PanelizationPanel', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('renders stats and updates global settings', () => {
    const model = createEmptyBuildingModel();
    const floor = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    model.floors.push(floor);
    model.walls.push(
      createWall({
        id: 'w1',
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
        thicknessMm: 174,
        wallType: 'external',
      })
    );
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(model),
    });
    render(<PanelizationPanel />);
    expect(screen.getByText(/SIP \/ Панелизация/i)).toBeTruthy();

    const minTrim = screen.getByDisplayValue(String(model.panelSettings.minTrimWidthMm));
    fireEvent.change(minTrim, { target: { value: '320' } });
    expect(useEditorStore.getState().document.draftModel?.panelSettings.minTrimWidthMm).toBe(320);
  });
});
