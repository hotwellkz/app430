import type { CSSProperties } from 'react';
import type { ArchitecturalImportSnapshot, ImportGeometryDiagnostics } from '@2wix/shared-types';

const box: CSSProperties = {
  marginTop: 10,
  padding: 8,
  borderRadius: 6,
  border: '1px dashed #94a3b8',
  background: '#f8fafc',
  fontSize: 11,
  lineHeight: 1.45,
};

function fmtArea(mm2: number | null): string {
  if (mm2 == null || !Number.isFinite(mm2)) return '—';
  if (mm2 >= 1_000_000) return `${(mm2 / 1_000_000).toFixed(2)} м²`;
  return `${Math.round(mm2)} мм²`;
}

function truncateJson(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}

export function ImportGeometryDebugSection({
  d,
  rawSnapshotJson,
  normalizedSnapshotJson,
}: {
  d: ImportGeometryDiagnostics;
  rawSnapshotJson?: ArchitecturalImportSnapshot | null;
  /** После review/transform (если есть) — сравнить с сырым extraction. */
  normalizedSnapshotJson?: ArchitecturalImportSnapshot | null;
}) {
  const st = d.geometryPipelineStages;

  return (
    <div style={box} data-testid="import-geometry-debug">
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>Geometry pipeline (debug)</div>
      <div>
        <span className="twix-muted">pipeline:</span> {d.pipelineVersion} · <span className="twix-muted">качество:</span>{' '}
        {d.qualityLevel}
      </div>
      {d.strategyExplanation ? (
        <div style={{ marginTop: 4, color: '#334155' }}>
          <span className="twix-muted">Стратегия:</span> {d.strategyExplanation}
        </div>
      ) : null}
      <div>
        <span className="twix-muted">AI сегментов (до norm):</span> {d.sourceWallSegmentCount} ·{' '}
        <span className="twix-muted">после norm (финал):</span> {d.segmentsAfterFilterAndRefine ?? '—'} ·{' '}
        <span className="twix-muted">стратегия:</span> {d.normalizationWallStrategy ?? '—'}
      </div>
      {d.candidateWallCount != null ? (
        <div>
          <span className="twix-muted">Стен в candidate:</span> {d.candidateWallCount}
        </div>
      ) : null}
      {d.outerContourClosed != null ? (
        <div>
          <span className="twix-muted">Контур замкнут (polygon):</span> {d.outerContourClosed ? 'да' : 'нет'}
        </div>
      ) : null}
      {st ? (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Стадии: short filter → refine → rescue (до shell)</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 16 }} className="twix-muted">
            <li>
              порог 1-го прохода: {st.minSegmentMmFirstPass} мм · сегм. после фильтра: {st.segmentsAfterShortFilter} · после
              refine: {st.segmentsAfterRefine}
            </li>
            <li>
              после rescue (до footprint shell): {st.segmentsAfterRescueBeforeShell}
              {st.lenientRetryUsed ? (
                <>
                  {' '}
                  · <strong>lenient</strong> {st.minSegmentMmLenientPass} мм: filter {st.segmentsAfterShortFilterAfterLenient ?? '—'}{' '}
                  → refine {st.segmentsAfterRefineAfterLenient ?? '—'} → rescue {st.segmentsAfterRescueAfterLenient ?? '—'}
                </>
              ) : null}
            </li>
          </ul>
        </details>
      ) : null}
      {d.rescuePassApplied ? (
        <div>
          <span className="twix-muted">внешн. сегм.:</span> {d.externalWallSegmentsBeforeRescue ?? '—'} →{' '}
          {d.externalWallSegmentsAfterRescue ?? '—'} · <span className="twix-muted">внутр.:</span>{' '}
          {d.internalWallSegmentsBeforeRescue ?? '—'} → {d.internalWallSegmentsAfterRescue ?? '—'}
        </div>
      ) : null}
      {d.openingsCountIn != null || d.openingsCountOut != null ? (
        <div>
          <span className="twix-muted">Проёмы:</span> {d.openingsCountIn ?? '—'} → {d.openingsCountOut ?? '—'}
        </div>
      ) : null}
      {d.geometryReasonCodes && d.geometryReasonCodes.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          <span className="twix-muted">Reason codes:</span> {d.geometryReasonCodes.join(', ')}
        </div>
      ) : null}
      <div>
        <span className="twix-muted">точек контура:</span> {d.sourceOuterContourPointCount}
      </div>
      <div>
        <span className="twix-muted">Площадь контура:</span> {fmtArea(d.footprintAreaMm2)}
      </div>
      <div>
        <span className="twix-muted">Контурный shell:</span> {d.usedFootprintShell ? 'да' : 'нет'} ·{' '}
        <span className="twix-muted">Крыша в модели:</span> {d.roofIncluded ? 'да' : 'нет'}
        {d.roofSuppressedReason ? (
          <>
            {' '}
            · <span className="twix-muted">крыша:</span> {d.roofSuppressedReason}
          </>
        ) : null}
      </div>
      {d.boundingBoxMm ? (
        <div className="twix-muted">
          bbox: {Math.round(d.boundingBoxMm.minX)}…{Math.round(d.boundingBoxMm.maxX)} ×{' '}
          {Math.round(d.boundingBoxMm.minY)}…{Math.round(d.boundingBoxMm.maxY)} мм
        </div>
      ) : null}
      {d.fallbacks.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          <span className="twix-muted">Fallbacks:</span> {d.fallbacks.join(', ')}
        </div>
      ) : null}
      {d.notes.length > 0 ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
          {d.notes.map((n, i) => (
            <li key={i} className="twix-muted">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      {rawSnapshotJson ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Raw import snapshot (JSON)</summary>
          <pre
            style={{
              margin: '6px 0 0',
              maxHeight: 220,
              overflow: 'auto',
              fontSize: 10,
              background: '#fff',
              padding: 6,
              borderRadius: 4,
              border: '1px solid #e2e8f0',
            }}
          >
            {truncateJson(JSON.stringify(rawSnapshotJson, null, 2), 12000)}
          </pre>
        </details>
      ) : null}
      {normalizedSnapshotJson ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Reviewed / transformed snapshot (JSON)</summary>
          <pre
            style={{
              margin: '6px 0 0',
              maxHeight: 220,
              overflow: 'auto',
              fontSize: 10,
              background: '#fff',
              padding: 6,
              borderRadius: 4,
              border: '1px solid #e2e8f0',
            }}
          >
            {truncateJson(JSON.stringify(normalizedSnapshotJson, null, 2), 12000)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
