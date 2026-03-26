import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ProjectVersion } from '@2wix/shared-types';
import {
  addFloorToModel,
  createEmptyBuildingModel,
  createFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { EditorLeftSidebar } from './EditorLeftSidebar';

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

describe('EditorLeftSidebar floors', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('lists floors sorted and switches active floor on click', () => {
    const f1 = createFloor({ id: 'a', label: 'Низ', sortIndex: 1, level: 1 });
    const f2 = createFloor({ id: 'b', label: 'Верх', sortIndex: 0, level: 2 });
    let m = createEmptyBuildingModel();
    m = addFloorToModel(m, f1);
    m = addFloorToModel(m, f2);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(m),
    });

    render(<EditorLeftSidebar />);
    expect(screen.getByText('Верх')).toBeTruthy();
    expect(screen.getByText('Низ')).toBeTruthy();

    fireEvent.click(screen.getByText('Низ'));
    expect(useEditorStore.getState().view.activeFloorId).toBe('a');
    expect(useEditorStore.getState().selection.selectedObjectId).toBe('a');
  });

  it('duplicate floor adds a floor', () => {
    const f1 = createFloor({ id: 'f1', label: 'Этаж 1', sortIndex: 0 });
    const m = addFloorToModel(createEmptyBuildingModel(), f1);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(m),
    });
    render(<EditorLeftSidebar />);
    fireEvent.click(screen.getAllByRole('button', { name: /Дублировать/i })[0]!);
    expect(useEditorStore.getState().document.draftModel!.floors.length).toBe(2);
  });

  it('delete floor shows confirm and removes floor when accepted', () => {
    const f1 = createFloor({ id: 'f1', label: 'A', sortIndex: 0 });
    const f2 = createFloor({ id: 'f2', label: 'B', sortIndex: 1 });
    let m = addFloorToModel(createEmptyBuildingModel(), f1);
    m = addFloorToModel(m, f2);
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: null,
      version: sampleVersion(m),
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<EditorLeftSidebar />);
    const rowB = screen.getAllByText('B')[0]!.closest('li');
    expect(rowB).toBeTruthy();
    fireEvent.click(within(rowB as HTMLElement).getByRole('button', { name: /Ещё…/i }));
    fireEvent.click(within(rowB as HTMLElement).getByRole('button', { name: /Удалить этаж/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(useEditorStore.getState().document.draftModel!.floors.length).toBe(1);

    confirmSpy.mockRestore();
  });
});
