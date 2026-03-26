import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditorStore } from '@2wix/editor-core';
import type { ExportArtifactMeta, ExportFormat } from '@2wix/shared-types';
import { getSipUserId } from '../identity/sipUser';
import { createProjectExport, useSipExports } from '../hooks/useSipProject';
import { getProjectExportDownloadUrl } from '../api/projectsApi';

interface ExportPanelProps {
  projectId: string;
  versionId: string | null;
  onSaveBeforeExport: () => Promise<boolean>;
}

export function ExportPanel({ projectId, versionId, onSaveBeforeExport }: ExportPanelProps) {
  const queryClient = useQueryClient();
  const hasUnsaved = useEditorStore((s) => s.document.hasUnsavedChanges);
  const [pendingChoice, setPendingChoice] = useState<ExportFormat | null>(null);
  const exportsQuery = useSipExports(projectId, true);
  const doExport = useMutation({
    mutationFn: async (input: { format: ExportFormat; retryOfExportId?: string }) => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет sipUserId для экспорта');
      return createProjectExport(projectId, {
        createdBy: uid,
        format: input.format,
        retryOfExportId: input.retryOfExportId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sip-exports', projectId] });
    },
  });
  const doDownload = useMutation({
    mutationFn: async (artifact: ExportArtifactMeta) => {
      if (artifact.fileUrl) return { url: artifact.fileUrl, fileName: artifact.fileName };
      return getProjectExportDownloadUrl(projectId, artifact.id);
    },
    onSuccess: ({ url, fileName }) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    },
  });

  const start = (format: ExportFormat) => {
    if (hasUnsaved) {
      setPendingChoice(format);
      return;
    }
    void doExport.mutate({ format });
  };
  const exportSavedVersion = () => {
    if (!pendingChoice) return;
    void doExport.mutate({ format: pendingChoice });
    setPendingChoice(null);
  };
  const saveAndExport = async () => {
    if (!pendingChoice) return;
    const ok = await onSaveBeforeExport();
    if (!ok) return;
    void doExport.mutate({ format: pendingChoice });
    setPendingChoice(null);
  };

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
      {pendingChoice ? (
        <div style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 8 }}>
          Есть несохранённые изменения. Как экспортировать?
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" style={{ fontSize: 11 }} onClick={saveAndExport}>
              Сохранить и экспортировать
            </button>
            <button type="button" style={{ fontSize: 11 }} onClick={exportSavedVersion}>
              Экспортировать текущую сохраненную версию
            </button>
            <button type="button" style={{ fontSize: 11 }} onClick={() => setPendingChoice(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}
      <p className="twix-muted" style={{ fontSize: 12 }}>
        Источник экспорта: текущая сохраненная версия {versionId ? versionId.slice(0, 8) : '—'}.
        {hasUnsaved ? ' Есть несохраненные изменения (в экспорт не попадут).' : ''}
      </p>
      {doExport.isError ? (
        <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{String(doExport.error)}</p>
      ) : null}
      {doDownload.isError ? (
        <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{String(doDownload.error)}</p>
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
              {e.versionId.slice(0, 8)}… · by {e.createdBy ?? '—'}{' '}
              {e.status === 'ready' ? (
                <button type="button" style={{ fontSize: 10 }} onClick={() => doDownload.mutate(e)}>
                  Скачать
                </button>
              ) : null}
              {e.status === 'failed' ? (
                <button
                  type="button"
                  style={{ fontSize: 10 }}
                  onClick={() => doExport.mutate({ format: e.format, retryOfExportId: e.id })}
                >
                  Retry
                </button>
              ) : null}
              {!e.storagePath ? <span style={{ color: '#64748b' }}> (legacy)</span> : null}
            </li>
          ))}
          {(exportsQuery.data?.exports ?? []).length === 0 ? <li>Выгрузок пока нет</li> : null}
        </ul>
      )}
    </div>
  );
}
