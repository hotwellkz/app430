import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { SpecPanel } from './SpecPanel';

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

describe('SpecPanel', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('shows empty state when no panelized walls', () => {
    const m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(m),
    });
    render(<SpecPanel />);
    expect(screen.getByText(/Нет панелизированных стен/i)).toBeTruthy();
  });

  it('renders aggregated table and export navigation button', () => {
    const m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    m.walls.push(
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
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(m),
    });
    render(<SpecPanel />);
    expect(screen.getAllByText(/Aggregated/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Скачать\/сформировать выгрузку/i })[0]!);
  });
});
