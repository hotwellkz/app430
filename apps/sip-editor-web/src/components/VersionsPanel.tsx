import type { ProjectVersion } from '@2wix/shared-types';
import { LoadingState } from '@2wix/ui-kit';

export interface VersionsPanelProps {
  versions: ProjectVersion[] | undefined;
  isLoading: boolean;
  currentVersionId: string | null;
}

export function VersionsPanel({
  versions,
  isLoading,
  currentVersionId,
}: VersionsPanelProps) {
  if (isLoading) {
    return <LoadingState message="Загрузка версий…" />;
  }
  if (!versions?.length) {
    return <p className="twix-muted">Нет версий</p>;
  }
  return (
    <div style={{ fontSize: 12, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--twix-border)' }}>
            <th style={{ padding: '4px 0' }}>#</th>
            <th>Создана</th>
            <th>Автор</th>
            <th>От версии</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => {
            const current = v.id === currentVersionId;
            return (
              <tr
                key={v.id}
                style={{
                  borderBottom: '1px solid #eee',
                  fontWeight: current ? 600 : 400,
                  background: current ? '#f4f4f5' : undefined,
                }}
              >
                <td style={{ padding: '6px 4px 6px 0' }}>{v.versionNumber}</td>
                <td>{new Date(v.createdAt).toLocaleString('ru-RU')}</td>
                <td>{v.createdBy ?? '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {v.basedOnVersionId ?? '—'}
                </td>
                <td>{current ? 'текущая' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
