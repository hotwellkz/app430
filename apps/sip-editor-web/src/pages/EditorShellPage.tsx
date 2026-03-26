import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VersionConflictDetails } from '@2wix/shared-types';
import { isBuildingModelEmpty } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { AppShell, EmptyState, LoadingState, RightPanel, TopBar } from '@2wix/ui-kit';
import { SipApiError } from '@/api/http';
import { createVersion, patchCurrentVersion } from '@/api/projectsApi';
import { EditorCanvas2D } from '@/canvas2d/EditorCanvas2D';
import { VersionsPanel } from '@/components/VersionsPanel';
import { EditorLeftSidebar } from '@/components/EditorLeftSidebar';
import { EditorToolbar } from '@/components/EditorToolbar';
import { WallInspector } from '@/components/WallInspector';
import { OpeningInspector } from '@/components/OpeningInspector';
import { getSipUserId } from '@/identity/sipUser';
import {
  useSipCurrentVersion,
  useSipProject,
  useSipVersionsList,
} from '@/hooks/useSipProject';
import { crmSipProjectsUrl } from '@/routes/crmEntry';

function isConflictDetails(v: unknown): v is VersionConflictDetails {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.currentVersionId === 'string' &&
    typeof o.currentVersionNumber === 'number' &&
    typeof o.serverUpdatedAt === 'string'
  );
}

function saveStatusLabel(status: string): string {
  switch (status) {
    case 'saving':
      return 'Сохранение…';
    case 'saved':
      return 'Сохранено';
    case 'dirty':
      return 'Черновик изменён';
    case 'conflict':
      return 'Конфликт версий';
    case 'error':
      return 'Ошибка сохранения';
    default:
      return 'Готово';
  }
}

const DEV_HINT =
  import.meta.env.DEV ? (
    <>
      <strong>Dev:</strong>{' '}
      <code style={{ fontSize: 12 }}>/sip-editor/&lt;projectId&gt;?sipUserId=&lt;uid&gt;</code>
      <br />
      <span className="twix-muted" style={{ fontSize: 12 }}>
        Локально:{' '}
        <Link to="/sip-editor/dev-launch" style={{ color: 'var(--twix-accent, #2563eb)' }}>
          dev-launch
        </Link>
      </span>
    </>
  ) : null;

function GuardCrmLinks() {
  const crmList = crmSipProjectsUrl();
  const btnStyle: CSSProperties = {
    display: 'inline-block',
    marginTop: 10,
    marginRight: 8,
    padding: '8px 14px',
    fontSize: 13,
    borderRadius: 6,
    background: '#0f172a',
    color: '#fff',
    textDecoration: 'none',
  };
  const btnSecondary: CSSProperties = {
    ...btnStyle,
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
  };
  return (
    <div style={{ marginTop: 12 }}>
      <a href={crmList} style={btnStyle}>
        Перейти к SIP Проектам
      </a>
      <a href={crmList} style={btnSecondary}>
        Открыть из CRM
      </a>
      <p className="twix-muted" style={{ fontSize: 12, marginTop: 10, maxWidth: 420 }}>
        В CRM: меню «SIP Проекты» или карточка сделки → проект откроется с вашим UID автоматически.
      </p>
    </div>
  );
}

export function EditorShellPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const sipUserId = getSipUserId();
  const fitViewRef = useRef<(() => void) | null>(null);

  const projectQuery = useSipProject(projectId);
  const versionQuery = useSipCurrentVersion(projectId);
  const version = versionQuery.data?.version;

  const loadDocumentFromServer = useEditorStore((s) => s.loadDocumentFromServer);
  const setProjectContext = useEditorStore((s) => s.setProjectContext);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const beginSave = useEditorStore((s) => s.beginSave);
  const applySaveSuccess = useEditorStore((s) => s.applySaveSuccess);
  const markSaveConflict = useEditorStore((s) => s.markSaveConflict);
  const markSaveError = useEditorStore((s) => s.markSaveError);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const history = useEditorStore((s) => s.history);

  const activePanel = view.activePanel;
  const [conflictDetails, setConflictDetails] = useState<VersionConflictDetails | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);
  const [syncToken, setSyncToken] = useState(0);

  const versionsQuery = useSipVersionsList(
    projectId,
    activePanel === 'versions'
  );

  useEffect(() => {
    const title = projectQuery.data?.project.title ?? null;
    if (projectId) {
      setProjectContext(projectId, title);
    }
  }, [projectId, projectQuery.data?.project.title, setProjectContext]);

  useEffect(() => {
    const v = versionQuery.data?.version;
    if (!v || !projectId) return;
    loadDocumentFromServer({
      projectId,
      projectTitle: projectQuery.data?.project.title ?? null,
      version: v,
    });
  }, [
    projectId,
    projectQuery.data?.project?.title,
    syncToken,
    loadDocumentFromServer,
    versionQuery.data?.version?.id,
    versionQuery.data?.version?.versionNumber,
    versionQuery.data?.version?.schemaVersion,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      const st = useEditorStore.getState().document;
      if (!st.draftModel) throw new Error('Нет черновика');
      if (
        st.currentVersionId === null ||
        st.currentVersionNumber === null ||
        st.schemaVersion === null
      ) {
        throw new Error('Нет ожиданий версии');
      }
      return patchCurrentVersion(projectId, {
        buildingModel: st.draftModel,
        updatedBy: uid,
        expectedCurrentVersionId: st.currentVersionId,
        expectedVersionNumber: st.currentVersionNumber,
        expectedSchemaVersion: st.schemaVersion,
      });
    },
    onMutate: () => {
      beginSave();
      setConflictDetails(null);
    },
    onSuccess: (res) => {
      applySaveSuccess(res.version);
      queryClient.setQueryData(['sip-current-version', projectId], { version: res.version });
      void queryClient.invalidateQueries({ queryKey: ['sip-project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['sip-versions', projectId] });
    },
    onError: (error: unknown) => {
      if (error instanceof SipApiError && error.status === 409) {
        markSaveConflict();
        const d = error.apiBody.details;
        setConflictDetails(isConflictDetails(d) ? d : null);
        return;
      }
      markSaveError(error instanceof Error ? error.message : String(error));
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: async () => {
      const uid = getSipUserId();
      if (!uid) throw new Error('Нет пользователя');
      return createVersion(projectId, {
        createdBy: uid,
        mode: 'clone-current',
      });
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['sip-current-version', projectId], { version: res.version });
      void queryClient.invalidateQueries({ queryKey: ['sip-project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['sip-versions', projectId] });
      loadDocumentFromServer({
        projectId,
        projectTitle: projectQuery.data?.project.title ?? null,
        version: res.version,
      });
      setConflictDetails(null);
    },
  });

  const reloadFromServer = useCallback(async () => {
    setConflictDetails(null);
    await versionQuery.refetch();
    await projectQuery.refetch();
    await versionsQuery.refetch();
    setSyncToken((n) => n + 1);
  }, [versionQuery, projectQuery, versionsQuery]);

  const updateMetaName = useCallback(
    (name: string) => {
      applyCommand({ type: 'setMetaName', name });
    },
    [applyCommand]
  );

  const summary = useMemo(() => {
    const p = projectQuery.data?.project;
    const v = versionQuery.data?.version;
    if (!p) return null;
    return {
      projectId: p.id,
      dealId: p.dealId,
      status: p.status,
      version: v?.versionNumber ?? '—',
      schemaVersion: v?.schemaVersion ?? '—',
      updatedAt: p.updatedAt,
    };
  }, [projectQuery.data?.project, versionQuery.data?.version]);

  const statusBadge = saveStatusLabel(document.saveStatus);
  const draft = document.draftModel;

  if (!projectId) {
    return (
      <div className="twix-ui" style={{ padding: 24 }}>
        <EmptyState
          title="Не указан projectId"
          description={
            <>
              Откройте проект из CRM (раздел SIP Проекты) — адрес соберётся автоматически.
              <GuardCrmLinks />
              {DEV_HINT}
            </>
          }
        />
      </div>
    );
  }

  if (!sipUserId) {
    return (
      <div className="twix-ui" style={{ padding: 24 }}>
        <EmptyState
          title="Не передан контекст пользователя"
          description={
            <>
              Для работы редактора нужен параметр <code>sipUserId</code> или вход через CRM.
              <GuardCrmLinks />
              {DEV_HINT}
            </>
          }
        />
      </div>
    );
  }

  if (projectQuery.isLoading || versionQuery.isLoading) {
    return (
      <div style={{ height: '100vh' }}>
        <LoadingState message="Загрузка проекта…" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <div style={{ height: '100vh', padding: 24 }}>
        <EmptyState
          title="Проект не найден или недоступен"
          description={
            <>
              <span>ID: {projectId}</span>
              <br />
              <span className="twix-muted">
                {projectQuery.error instanceof SipApiError
                  ? projectQuery.error.message
                  : String(projectQuery.error)}
              </span>
              <GuardCrmLinks />
            </>
          }
        />
      </div>
    );
  }

  if (versionQuery.isError) {
    return (
      <div style={{ height: '100vh', padding: 24 }}>
        <EmptyState
          title="Версия не загружена"
          description={
            versionQuery.error instanceof SipApiError
              ? versionQuery.error.message
              : String(versionQuery.error)
          }
        />
      </div>
    );
  }

  if (!draft || !version) {
    return (
      <div style={{ height: '100vh' }}>
        <LoadingState message="Инициализация модели…" />
      </div>
    );
  }

  const modelEmpty = isBuildingModelEmpty(draft);

  const mainContent =
    activePanel === 'versions' ? (
      <div style={{ flex: 1, margin: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <p className="twix-panelTitle" style={{ flex: 'none' }}>
          История версий
        </p>
        <VersionsPanel
          versions={versionsQuery.data?.versions}
          isLoading={versionsQuery.isLoading}
          currentVersionId={projectQuery.data?.project.currentVersionId ?? null}
        />
      </div>
    ) : (
      <div
        style={{
          flex: 1,
          margin: 12,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {modelEmpty ? (
          <div style={{ flex: 'none' }}>
            <EmptyState
              title="Пустая модель"
              description="Добавьте этаж слева, затем инструмент «Стена» на canvas или кнопку + Этаж и рисование."
            />
          </div>
        ) : null}
        <EditorCanvas2D onRegisterFitView={(fn) => { fitViewRef.current = fn; }} />
      </div>
    );

  return (
    <div style={{ height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <AppShell
        topBar={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <TopBar
              title={
                <>
                  SIP Editor — {projectQuery.data?.project.title ?? 'проект'}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--twix-muted)' }}>
                    (v{version.versionNumber} · {projectId.slice(0, 8)}…)
                  </span>
                </>
              }
            />
            <EditorToolbar
              statusBadge={statusBadge}
              onSave={() => saveMutation.mutate()}
              onNewVersion={() => newVersionMutation.mutate()}
              savePending={saveMutation.isPending}
              newVersionPending={newVersionMutation.isPending}
              onFitView={() => fitViewRef.current?.()}
            />
          </div>
        }
        sidebar={<EditorLeftSidebar />}
        main={mainContent}
        rightPanel={
          <RightPanel>
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                border: '1px solid var(--twix-border)',
                borderRadius: 8,
                background: 'var(--twix-surface, #fff)',
              }}
            >
              <button
                type="button"
                onClick={() => setDebugOpen((o) => !o)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Debug {debugOpen ? '▼' : '▶'}
              </button>
              {debugOpen ? (
                <dl
                  style={{
                    margin: '8px 0 0',
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <dt className="twix-muted">toolMode</dt>
                  <dd style={{ margin: 0 }}>{view.toolMode}</dd>
                  <dt className="twix-muted">projectId</dt>
                  <dd style={{ margin: 0 }}>{document.projectId ?? '—'}</dd>
                  <dt className="twix-muted">versionId</dt>
                  <dd style={{ margin: 0 }}>{document.currentVersionId ?? '—'}</dd>
                  <dt className="twix-muted">versionNumber</dt>
                  <dd style={{ margin: 0 }}>{document.currentVersionNumber ?? '—'}</dd>
                  <dt className="twix-muted">selected</dt>
                  <dd style={{ margin: 0 }}>
                    {selection.selectedObjectType ?? '—'}{' '}
                    {selection.selectedObjectId?.slice(0, 8) ?? ''}
                  </dd>
                  <dt className="twix-muted">activeFloorId</dt>
                  <dd style={{ margin: 0 }}>{view.activeFloorId ?? '—'}</dd>
                  <dt className="twix-muted">saveStatus</dt>
                  <dd style={{ margin: 0 }}>{document.saveStatus}</dd>
                  <dt className="twix-muted">hasUnsavedChanges</dt>
                  <dd style={{ margin: 0 }}>{String(document.hasUnsavedChanges)}</dd>
                  <dt className="twix-muted">undo / redo len</dt>
                  <dd style={{ margin: 0 }}>
                    {history.past.length} / {history.future.length}
                  </dd>
                </dl>
              ) : null}
            </div>

            {document.saveStatus === 'conflict' ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <strong>Данные на сервере новее.</strong>
                {conflictDetails ? (
                  <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11 }}>
                    Текущая версия: #{conflictDetails.currentVersionNumber} (
                    {conflictDetails.currentVersionId.slice(0, 8)}…)
                    <br />
                    Обновлено: {new Date(conflictDetails.serverUpdatedAt).toLocaleString('ru-RU')}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void reloadFromServer()}
                  style={{ marginTop: 8, fontSize: 12, padding: '4px 10px' }}
                >
                  Загрузить с сервера
                </button>
              </div>
            ) : null}

            {selection.selectedObjectType === 'opening' ? <OpeningInspector /> : <WallInspector />}

            <p className="twix-panelTitle" style={{ marginTop: 16 }}>
              Активный раздел
            </p>
            <p className="twix-muted" style={{ fontSize: 13 }}>
              {activePanel}
            </p>

            <p className="twix-panelTitle" style={{ marginTop: 12 }}>
              Черновик модели
            </p>
            <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
              meta.name
            </label>
            <input
              type="text"
              value={draft.meta.name}
              onChange={(e) => updateMetaName(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: 6,
                fontSize: 13,
                border: '1px solid var(--twix-border)',
                borderRadius: 4,
              }}
            />
            <button type="button" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => clearSelection()}>
              Снять выделение
            </button>

            <p className="twix-panelTitle" style={{ marginTop: 16 }}>
              Проект
            </p>
            {summary ? (
              <dl
                style={{
                  margin: 0,
                  fontSize: 13,
                  display: 'grid',
                  gap: 6,
                  color: 'var(--twix-text)',
                }}
              >
                <dt className="twix-muted">Статус</dt>
                <dd style={{ margin: 0 }}>{summary.status}</dd>
                <dt className="twix-muted">Версия</dt>
                <dd style={{ margin: 0 }}>{summary.version}</dd>
                <dt className="twix-muted">schemaVersion</dt>
                <dd style={{ margin: 0 }}>{summary.schemaVersion}</dd>
                <dt className="twix-muted">Обновлён (проект)</dt>
                <dd style={{ margin: 0 }}>
                  {new Date(summary.updatedAt).toLocaleString('ru-RU')}
                </dd>
                <dt className="twix-muted">dealId</dt>
                <dd style={{ margin: 0 }}>{summary.dealId ?? '—'}</dd>
              </dl>
            ) : (
              <p className="twix-muted">—</p>
            )}
          </RightPanel>
        }
      />
    </div>
  );
}
