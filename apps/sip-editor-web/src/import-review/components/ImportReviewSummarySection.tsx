import type { CSSProperties } from 'react';
import type { ImportSummaryViewModel } from '../viewModel/importSummaryViewModel.types';

const cardStyle: CSSProperties = {
  marginBottom: 12,
  padding: 10,
  border: '1px solid var(--twix-border)',
  borderRadius: 8,
  background: 'var(--twix-surface, #fff)',
};

const badgeStyle = (tone: 'neutral' | 'ok' | 'warn' | 'bad'): CSSProperties => ({
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
  marginRight: 4,
  marginBottom: 4,
  background:
    tone === 'ok'
      ? '#dcfce7'
      : tone === 'warn'
        ? '#fef9c3'
        : tone === 'bad'
          ? '#fee2e2'
          : '#f1f5f9',
  color: '#0f172a',
});

export function ImportReviewSummarySection({ vm }: { vm: ImportSummaryViewModel }) {
  return (
    <div data-testid="ir-import-summary" style={{ ...cardStyle, padding: 8, marginBottom: 10 }}>
      <p className="twix-panelTitle" style={{ margin: '0 0 8px', fontSize: 12 }}>
        {vm.sectionTitle}
      </p>

      <div style={{ marginBottom: 10 }}>
        <p className="twix-muted" style={{ fontSize: 11, margin: '0 0 6px' }}>
          Статусы pipeline
        </p>
        <div>
          {vm.pipelineBadges.map((b) => (
            <span key={b.key} title={`${b.label}: ${b.text}`} style={badgeStyle(b.tone)}>
              {b.label}: {b.text}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{vm.savedDecisions.title}</p>
        {vm.savedDecisions.hint ? (
          <p className="twix-muted" style={{ fontSize: 12, margin: 0 }} data-testid="ir-summary-saved-hint">
            {vm.savedDecisions.hint}
          </p>
        ) : null}
        {!vm.savedDecisions.hint && vm.savedDecisions.lines.length === 0 ? (
          <p className="twix-muted" style={{ fontSize: 12, margin: 0 }}>
            —
          </p>
        ) : null}
        {vm.savedDecisions.lines.length > 0 ? (
          <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }} data-testid="ir-summary-saved-lines">
            {vm.savedDecisions.lines.map((line, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{vm.candidate.title}</p>
        {vm.candidate.hint ? (
          <p className="twix-muted" style={{ fontSize: 12, margin: 0 }} data-testid="ir-summary-candidate-hint">
            {vm.candidate.hint}
          </p>
        ) : null}
        {vm.candidate.lines.length > 0 ? (
          <div style={{ marginTop: 6, fontSize: 12 }} data-testid="ir-summary-candidate-lines">
            {vm.candidate.lines.map((row, i) => (
              <div key={`${row.label}-${i}`} style={{ marginBottom: 4 }}>
                <span className="twix-muted">{row.label}: </span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{vm.projectApply.title}</p>
        {vm.projectApply.hint ? (
          <p className="twix-muted" style={{ fontSize: 12, margin: 0 }} data-testid="ir-summary-project-hint">
            {vm.projectApply.hint}
          </p>
        ) : null}
        {vm.projectApply.lines.length > 0 ? (
          <div style={{ marginTop: 6, fontSize: 12 }} data-testid="ir-summary-project-lines">
            {vm.projectApply.lines.map((row, i) => (
              <div key={`${row.label}-${i}`} style={{ marginBottom: 4 }}>
                <span className="twix-muted">{row.label}: </span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
