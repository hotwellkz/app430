import { buildDraftSipBomSnapshot } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { useMemo } from 'react';

export function DraftSipBomPanel() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const bom = useMemo(() => (draft ? buildDraftSipBomSnapshot(draft) : null), [draft]);

  if (!bom || bom.project.wallsWithLayout === 0) {
    return (
      <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
        <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
          Спецификация SIP (черновик)
        </p>
        <p className="twix-muted" style={{ fontSize: 12 }}>
          Нет сохранённых раскладок стен. Нажмите «Рассчитать панели» у выбранной стены или batch по этажу.
        </p>
      </div>
    );
  }

  const p = bom.project;
  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <p className="twix-panelTitle" style={{ marginBottom: 6 }}>
        Спецификация SIP (черновик)
      </p>
      <p className="twix-muted" style={{ fontSize: 11, marginBottom: 8 }}>
        {bom.disclaimer}
      </p>
      <p className="twix-muted" style={{ fontSize: 12 }}>
        Проект: панелей SIP {p.sipPanelsTotal} · trim {p.trimPanelsTotal} · стен с раскладкой {p.wallsWithLayout}{' '}
        · ready / partial / invalid: {p.wallsReady} / {p.wallsPartial} / {p.wallsInvalid} · устаревших раскладок{' '}
        {p.staleLayouts} · предупреждений {p.warningsTotal}
      </p>
      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>
        По типам панелей
      </p>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Код</th>
            <th style={{ textAlign: 'right' }}>Шт.</th>
            <th style={{ textAlign: 'right' }}>Trim</th>
            <th style={{ textAlign: 'right' }}>S, м²</th>
          </tr>
        </thead>
        <tbody>
          {bom.byPanelType.map((row) => (
            <tr key={row.panelTypeId}>
              <td>{row.code}</td>
              <td style={{ textAlign: 'right' }}>{row.panelCount}</td>
              <td style={{ textAlign: 'right' }}>{row.trimCount}</td>
              <td style={{ textAlign: 'right' }}>{row.totalAreaM2}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>
        По этажам
      </p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {bom.byFloor.map((f) => (
          <li key={f.floorId}>
            {f.floorId.slice(0, 8)}… · панелей {f.sipPanelsTotal} · trim {f.trimPanelsTotal} · ready/partial/invalid{' '}
            {f.wallsReady}/{f.wallsPartial}/{f.wallsInvalid} · stale {f.staleLayouts} · предупр. {f.warningsTotal}
          </li>
        ))}
      </ul>
    </div>
  );
}
