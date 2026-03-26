import { useEditorStore } from '@2wix/editor-core';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';

export function PanelizationPanel() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const snapshot = usePanelizationSnapshot();
  if (!draft || !snapshot) return null;

  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <p className="twix-panelTitle" style={{ marginBottom: 8 }}>
        SIP / Панелизация
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <label>
          default panel type
          <select
            value={draft.panelSettings.defaultPanelTypeId ?? ''}
            onChange={(e) =>
              applyCommand({
                type: 'updatePanelSettings',
                patch: { defaultPanelTypeId: e.target.value || null },
              })
            }
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">—</option>
            {draft.panelLibrary.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} ({p.widthMm}x{p.heightMm})
              </option>
            ))}
          </select>
        </label>
        <label>
          min trim (мм)
          <input
            type="number"
            min={10}
            step={10}
            value={draft.panelSettings.minTrimWidthMm}
            onChange={(e) =>
              applyCommand({
                type: 'updatePanelSettings',
                patch: { minTrimWidthMm: Math.max(10, Number(e.target.value) || 10) },
              })
            }
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={draft.panelSettings.allowTrimmedPanels}
            onChange={(e) =>
              applyCommand({
                type: 'updatePanelSettings',
                patch: { allowTrimmedPanels: e.target.checked },
              })
            }
          />{' '}
          allow trimmed
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.panelSettings.preferFullPanels}
            onChange={(e) =>
              applyCommand({
                type: 'updatePanelSettings',
                patch: { preferFullPanels: e.target.checked },
              })
            }
          />{' '}
          prefer full
        </label>
      </div>
      <p className="twix-muted" style={{ fontSize: 12, marginTop: 8 }}>
        Walls: {snapshot.stats.wallPanels} · Slabs: {snapshot.stats.slabPanels} · Roof: {snapshot.stats.roofPanels} ·
        Total: {snapshot.stats.generatedPanels} · Trimmed: {snapshot.stats.trimmedPanels} · Warnings:{' '}
        {snapshot.stats.warnings} · Errors: {snapshot.stats.errors}
      </p>
      <p className="twix-muted" style={{ fontSize: 12, marginTop: 4 }}>
        Eligible walls/slabs/roofs: {snapshot.stats.eligibleWalls}/{snapshot.stats.eligibleSlabs}/{snapshot.stats.eligibleRoofs}
      </p>
      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }}>
        <li>Walls: {snapshot.wallSummaries.filter((w) => w.panelCount > 0).length} объектов</li>
        <li>Slabs: {snapshot.slabSummaries.filter((s) => s.panelCount > 0).length} объектов</li>
        <li>Roof: {snapshot.roofSummaries.filter((r) => r.panelCount > 0).length} объектов</li>
      </ul>
      {snapshot.warnings.length > 0 ? (
        <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12 }}>
          {snapshot.warnings.slice(0, 8).map((w) => (
            <li key={w.id}>
              [{w.code}] {w.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
