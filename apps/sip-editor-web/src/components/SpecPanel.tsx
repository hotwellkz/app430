import { useEditorStore } from '@2wix/editor-core';
import { useState } from 'react';
import type { SpecSourceType } from '@2wix/spec-engine';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

export function SpecPanel() {
  const snapshot = useSpecSnapshot();
  const selectObject = useEditorStore((s) => s.selectObject);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const [filter, setFilter] = useState<'all' | SpecSourceType>('all');

  if (!snapshot || snapshot.summary.totalPanels === 0) {
    return (
      <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
        <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
          Спецификация / BOM
        </p>
        <p className="twix-muted" style={{ fontSize: 12 }}>
          Нет панелизированных элементов для спецификации. Проверьте SIP-настройки и eligibility стен/перекрытий/крыши.
        </p>
      </div>
    );
  }

  const filteredItems = snapshot.items.filter((x) => filter === 'all' || x.sourceType === filter || x.sourceType === 'mixed');
  const filteredWalls = filter === 'all' || filter === 'wall' ? snapshot.wallSummaries : [];
  const filteredSlabs = filter === 'all' || filter === 'slab' ? snapshot.slabSummaries : [];
  const filteredRoofs = filter === 'all' || filter === 'roof' ? snapshot.roofSummaries : [];

  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
        Спецификация / BOM
      </p>
      <p className="twix-muted" style={{ fontSize: 12 }}>
        Panels: {snapshot.summary.totalPanels} · Trimmed: {snapshot.summary.totalTrimmedPanels} · Area:{' '}
        {snapshot.summary.totalPanelAreaM2} m2 · W/S/R: {snapshot.summary.wallCountIncluded}/
        {snapshot.summary.slabCountIncluded}/{snapshot.summary.roofCountIncluded} · Warnings: {snapshot.summary.warningCount}
      </p>
      <p className="twix-muted" style={{ fontSize: 12 }}>
        By source panels: W {snapshot.summary.totalsBySourceType.wall.panels} · S {snapshot.summary.totalsBySourceType.slab.panels} · R {snapshot.summary.totalsBySourceType.roof.panels}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
        <button type="button" style={{ fontSize: 11 }} onClick={() => setActivePanel('exports')}>
          Скачать/сформировать выгрузку
        </button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | SpecSourceType)}
          style={{ fontSize: 11 }}
        >
          <option value="all">all</option>
          <option value="wall">walls</option>
          <option value="slab">slabs</option>
          <option value="roof">roof</option>
        </select>
      </div>

      <p className="twix-panelTitle" style={{ fontSize: 12 }}>Aggregated</p>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Code</th>
            <th style={{ textAlign: 'left' }}>Name</th>
            <th style={{ textAlign: 'left' }}>Source</th>
            <th style={{ textAlign: 'left' }}>Unit</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.id}>
              <td>{item.code}</td>
              <td>{item.name}</td>
              <td>{item.sourceType}</td>
              <td>{item.unit}</td>
              <td style={{ textAlign: 'right' }}>{item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>Walls</p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {filteredWalls.map((w) => (
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
        {filteredWalls.length === 0 ? <li>Нет данных</li> : null}
      </ul>

      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>Slabs</p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {filteredSlabs.map((s) => (
          <li key={s.slabId}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}
              onClick={() => selectObject(s.slabId, 'slab')}
            >
              {s.slabId.slice(0, 8)}…
            </button>{' '}
            · floor {s.floorId} · panels {s.panelCount} · trimmed {s.trimmedCount} · area {s.totalAreaM2} m2
          </li>
        ))}
        {filteredSlabs.length === 0 ? <li>Нет данных</li> : null}
      </ul>

      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>Roof</p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {filteredRoofs.map((r) => (
          <li key={r.roofId}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}
              onClick={() => selectObject(r.roofId, 'roof')}
            >
              {r.roofId.slice(0, 8)}…
            </button>{' '}
            · floor {r.floorId} · panels {r.panelCount} · trimmed {r.trimmedCount} · area {r.totalAreaM2} m2
          </li>
        ))}
        {filteredRoofs.length === 0 ? <li>Нет данных</li> : null}
      </ul>

      {snapshot.warnings.length > 0 ? (
        <>
          <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>Warnings</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
            {snapshot.warnings.slice(0, 8).map((w) => (
              <li key={w.id}>
                [{w.code}] {w.message}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
