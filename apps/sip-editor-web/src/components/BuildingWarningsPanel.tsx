import { collectVerticalWarnings } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';

export function BuildingWarningsPanel() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const panelization = usePanelizationSnapshot();
  if (!draft) return null;
  const warnings = collectVerticalWarnings(draft);
  const panelWarnings = panelization?.warnings ?? [];
  if (warnings.length === 0 && panelWarnings.length === 0) return null;

  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #f59e0b', borderRadius: 8, background: '#fffbeb' }}>
      <p className="twix-panelTitle" style={{ marginBottom: 6 }}>Предупреждения модели</p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
        {warnings.map((w, i) => (
          <li key={`${w.code}-${w.floorId ?? 'global'}-${i}`}>{w.message}</li>
        ))}
        {panelWarnings.map((w) => (
          <li key={w.id}>
            [{w.code}] {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
