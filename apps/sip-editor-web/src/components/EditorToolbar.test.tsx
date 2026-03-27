import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectVersion } from '@2wix/shared-types';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { EditorToolbar } from './EditorToolbar';

function sampleVersion(): ProjectVersion {
  return {
    id: 'v1',
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: createEmptyBuildingModel(),
    createdAt: '2025-01-01T00:00:00.000Z',
    createdBy: 'u1',
  };
}

function mountToolbar(onOpenAiImport?: () => void) {
  return render(
    <EditorToolbar
      statusBadge="ok"
      onSave={() => {}}
      onNewVersion={() => {}}
      savePending={false}
      newVersionPending={false}
      onOpenAiImport={onOpenAiImport}
    />
  );
}

describe('EditorToolbar AI import button', () => {
  beforeEach(() => {
    cleanup();
    useEditorStore.getState().reset();
    useEditorStore.getState().loadDocumentFromServer({
      projectId: 'p1',
      projectTitle: 'Проект',
      version: sampleVersion(),
    });
  });

  it('shows AI import button and calls callback on click', () => {
    const onOpenAiImport = vi.fn();
    mountToolbar(onOpenAiImport);

    const btn = screen.getByTestId('editor-toolbar-ai-import') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);

    fireEvent.click(btn);
    expect(onOpenAiImport).toHaveBeenCalledTimes(1);
  });

  it('keeps AI import button visible when callback is not provided', () => {
    mountToolbar(undefined);

    const btn = screen.getByTestId('editor-toolbar-ai-import') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });
});
