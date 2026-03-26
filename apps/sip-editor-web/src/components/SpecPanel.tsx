import { useEditorStore } from '@2wix/editor-core';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

export function SpecPanel() {
  const snapshot = useSpecSnapshot();
  const selectObject = useEditorStore((s) => s.selectObject);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);

  if (!snapshot || snapshot.summary.totalPanels === 0) {
    return (
      <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
        <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
          Спецификация / BOM
        </p>
        <p className="twix-muted" style={{ fontSize: 12 }}>
          Нет панелизированных стен для спецификации. Проверьте SIP-настройки и eligibility стен.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
        Спецификация / BOM
      </p>
      <p className="twix-muted" style={{ fontSize: 12 }}>
        Panels: {snapshot.summary.totalPanels} · Trimmed: {snapshot.summary.totalTrimmedPanels} · Area:{' '}
        {snapshot.summary.totalPanelAreaM2} m2 · Walls: {snapshot.summary.wallCountIncluded} · Warnings:{' '}
        {snapshot.summary.warningCount}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
        <button type="button" style={{ fontSize: 11 }} onClick={() => setActivePanel('exports')}>
          Скачать/сформировать выгрузку
        </button>
      </div>

      <p className="twix-panelTitle" style={{ fontSize: 12 }}>Aggregated</p>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Code</th>
            <th style={{ textAlign: 'left' }}>Name</th>
            <th style={{ textAlign: 'left' }}>Unit</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.items.map((item) => (
            <tr key={item.id}>
              <td>{item.code}</td>
              <td>{item.name}</td>
              <td>{item.unit}</td>
              <td style={{ textAlign: 'right' }}>{item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>By wall</p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {snapshot.wallSummaries.map((w) => (
          <li key={w.wallId}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}
              onClick={() => selectObject(w.wallId, 'wall')}
            >
              {w.wallId.slice(0, 8)}…
            </button>{' '}
            · floor {w.floorId} · panels {w.panelCount} · trimmed {w.trimmedCount} · area {w.totalAreaM2} m2
          </li>
        ))}
      </ul>
    </div>
  );
}
