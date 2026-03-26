import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { ProjectVersion } from '@2wix/shared-types';
import { EditorCanvas2D } from './EditorCanvas2D';

class RO {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', RO);

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

describe('panel overlay toggle', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('toggles panel overlay visibility button', () => {
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
      })
    );
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 't',
      version: makeVersion(m),
    });
    render(<EditorCanvas2D />);
    const btn = screen.getByRole('button', { name: /Скрыть панели/i });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /Показать панели/i })).toBeTruthy();
  });
});
