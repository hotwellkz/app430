import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditorStore } from '@2wix/editor-core';
import type { ExportFormat } from '@2wix/shared-types';
import { downloadExportSnapshot } from '../export/renderExportFiles';
import { getSipUserId } from '../identity/sipUser';
import { createProjectExport, useSipExports } from '../hooks/useSipProject';

interface ExportPanelProps {
  projectId: string;
  versionId: string | null;
}

export function ExportPanel({ projectId, versionId }: ExportPanelProps) {
  const queryClient = useQueryClient();
  const hasUnsaved = useEditorStore((s) => s.document.hasUnsavedChanges);
  const exportsQuery = useSipExports(projectId, true);
  const doExport = useMutation({
    mutationFn: async (format: ExportFormat) => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет sipUserId для экспорта');
      return createProjectExport(projectId, { createdBy: uid, format });
    },
    onSuccess: (res) => {
      downloadExportSnapshot(res.snapshot, res.artifact.format, res.artifact.fileName);
      void queryClient.invalidateQueries({ queryKey: ['sip-exports', projectId] });
    },
  });

  const start = (format: ExportFormat) => void doExport.mutate(format);

  return (
    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <p className="twix-panelTitle" style={{ marginBottom: 8 }}>
        Экспорт / Выгрузки
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" style={{ fontSize: 11 }} onClick={() => start('pdf')} disabled={doExport.isPending}>
          Скачать PDF
        </button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => start('csv')} disabled={doExport.isPending}>
          Скачать CSV
        </button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => start('xlsx')} disabled={doExport.isPending}>
          Скачать XLSX
        </button>
      </div>
      <p className="twix-muted" style={{ fontSize: 12 }}>
        Источник экспорта: текущая сохраненная версия {versionId ? versionId.slice(0, 8) : '—'}.
        {hasUnsaved ? ' Есть несохраненные изменения (в экспорт не попадут).' : ''}
      </p>
      {doExport.isError ? (
        <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{String(doExport.error)}</p>
      ) : null}
      <p className="twix-panelTitle" style={{ fontSize: 12, marginTop: 10 }}>
        Последние выгрузки
      </p>
      {exportsQuery.isLoading ? (
        <p className="twix-muted" style={{ fontSize: 12 }}>Загрузка…</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
          {(exportsQuery.data?.exports ?? []).slice(0, 10).map((e) => (
            <li key={e.id}>
              {e.format.toUpperCase()} · {e.status} · {new Date(e.createdAt).toLocaleString('ru-RU')} · v:{' '}
              {e.versionId.slice(0, 8)}… · by {e.createdBy ?? '—'}
            </li>
          ))}
          {(exportsQuery.data?.exports ?? []).length === 0 ? <li>Выгрузок пока нет</li> : null}
        </ul>
      )}
    </div>
  );
}
