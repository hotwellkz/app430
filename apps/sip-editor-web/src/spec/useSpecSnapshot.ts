import { useMemo } from 'react';
import { buildSpecSnapshot } from '@2wix/spec-engine';
import { useEditorStore } from '@2wix/editor-core';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';

export function useSpecSnapshot() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const panelization = usePanelizationSnapshot();
  return useMemo(() => {
    if (!draft || !panelization) return null;
    return buildSpecSnapshot(draft, panelization);
  }, [draft, panelization]);
}
