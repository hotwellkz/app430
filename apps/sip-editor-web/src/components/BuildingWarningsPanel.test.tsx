import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProjectVersion } from '@2wix/shared-types';
import { addFloorToModel, createEmptyBuildingModel, createFloor } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { BuildingWarningsPanel } from './BuildingWarningsPanel';

function sampleVersion(model: ReturnType<typeof createEmptyBuildingModel>): ProjectVersion {
  return {
    id: 'v1',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: model,
    createdAt: '2025-01-01T00:00:00.000Z',
    createdBy: 'u1',
  };
}

describe('BuildingWarningsPanel', () => {
  beforeEach(() => useEditorStore.getState().reset());

  it('renders vertical mismatch warning', () => {
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, createFloor({ id: 'f1', level: 1, elevationMm: 0, heightMm: 2800, sortIndex: 0 }));
    m = addFloorToModel(m, createFloor({ id: 'f2', level: 2, elevationMm: 2500, heightMm: 2800, sortIndex: 1 }));
    useEditorStore.getState().loadDocumentFromServer({ projectId: 'p1', projectTitle: null, version: sampleVersion(m) });
    render(<BuildingWarningsPanel />);
    expect(screen.getByText(/не совпадает с ожидаемой/i)).toBeTruthy();
  });
});
