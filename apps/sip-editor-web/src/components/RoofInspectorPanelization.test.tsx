import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createEmptyBuildingModel, createFloor, createRoof, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { RoofInspector } from './RoofInspector';

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

describe('RoofInspector panelization', () => {
  beforeEach(() => useEditorStore.getState().reset());

  it('renders roof panelization summary fields', () => {
    const m = createEmptyBuildingModel();
    const f = createFloor({ id: 'f1', label: '1', level: 1, sortIndex: 0 });
    m.floors.push(f);
    m.walls.push(createWall({ id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thicknessMm: 174 }));
    m.roofs.push(
      createRoof({
        id: 'r1',
        floorId: 'f1',
        roofType: 'single_slope',
        slopeDegrees: 25,
        overhangMm: 250,
        baseElevationMm: 2800,
      })
    );
    useEditorStore.getState().loadDocumentFromServer({ projectId: 'p1', projectTitle: 't', version: makeVersion(m) });
    useEditorStore.getState().selectObject('r1', 'roof');
    render(<RoofInspector />);
    expect(screen.getByText(/SIP panels \/ trimmed \/ area/i)).toBeTruthy();
    expect(screen.getByText(/SPEC panels \/ trimmed \/ area/i)).toBeTruthy();
  });
});
