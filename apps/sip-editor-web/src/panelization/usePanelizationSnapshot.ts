import { useMemo } from 'react';
import { useEditorStore } from '@2wix/editor-core';
import { buildPanelizationSnapshot } from '@2wix/panel-engine';

export function usePanelizationSnapshot() {
  const draft = useEditorStore((s) => s.document.draftModel);
  return useMemo(() => {
    if (!draft) return null;
    return buildPanelizationSnapshot(draft);
  }, [draft]);
}
