import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VersionConflictDetails } from '@2wix/shared-types';
import {
  createFloor,
  DEFAULT_FLOOR_HEIGHT_MM,
  isBuildingModelEmpty,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { AppShell, EmptyState, LoadingState, RightPanel, TopBar } from '@2wix/ui-kit';
import { SipApiError } from '@/api/http';
import { createVersion, patchCurrentVersion } from '@/api/projectsApi';
import { EditorCanvas2D } from '@/canvas2d/EditorCanvas2D';
import { VersionsPanel } from '@/components/VersionsPanel';
import { EditorLeftSidebar } from '@/components/EditorLeftSidebar';
import { EditorToolbar } from '@/components/EditorToolbar';
import { BuildingSummaryPanel } from '@/components/BuildingSummaryPanel';
import { BuildingWarningsPanel } from '@/components/BuildingWarningsPanel';
import { PanelizationPanel } from '@/components/PanelizationPanel';
import { SpecPanel } from '@/components/SpecPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { ImportApplyHistoryPanel } from '@/components/ImportApplyHistoryPanel';
import { ImportReviewPanel } from '@/components/ImportReviewPanel';
import { FloorInspector } from '@/components/FloorInspector';
import { OpeningInspector } from '@/components/OpeningInspector';
import { RoofInspector } from '@/components/RoofInspector';
import { SlabInspector } from '@/components/SlabInspector';
import { WallInspector } from '@/components/WallInspector';
import { Preview3DPanel } from '@/components/Preview3DPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getSipUserId, resolveSipUserContext } from '@/identity/sipUser';
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

function describeLoadError(error: unknown, fallbackTitle: string): { title: string; message: string } {
  if (!(error instanceof SipApiError)) {
    return { title: fallbackTitle, message: String(error) };
  }
  if (error.status === 404) {
    if (error.message.toLowerCase().includes('текущая версия')) {
      return { title: 'У проекта не назначена текущая версия', message: error.message };
    }
    return { title: 'Проект или версия не найдены', message: error.message };
  }
  if (error.status === 403) {
    return { title: 'Недостаточно прав доступа', message: error.message };
  }
  if (error.status === 401) {
    return { title: 'Нет пользовательского контекста', message: error.message };
  }
  if (error.status === 503 || error.status === 504) {
    return {
      title: 'SIP API временно недоступен',
      message: `${error.message}${error.apiBody.requestId ? ` (requestId: ${error.apiBody.requestId})` : ''}`,
    };
  }
  return {
    title: fallbackTitle,
    message: `${error.message}${error.apiBody.requestId ? ` (requestId: ${error.apiBody.requestId})` : ''}`,
  };
}

export function EditorShellPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const sipUserId = getSipUserId();
  const sipUserCtx = resolveSipUserContext();
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
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);

  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const history = useEditorStore((s) => s.history);

  const activePanel = view.activePanel;
  const [conflictDetails, setConflictDetails] = useState<VersionConflictDetails | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);
  const [syncToken, setSyncToken] = useState(0);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

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

  const saveBeforeExport = useCallback(async () => {
    try {
      await saveMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }, [saveMutation]);

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
              <br />
              <span className="twix-muted" style={{ fontSize: 12 }}>
                Источник контекста: {sipUserCtx.source}
              </span>
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
    const d = describeLoadError(projectQuery.error, 'Проект не найден или недоступен');
    return (
      <div style={{ height: '100vh', padding: 24 }}>
        <EmptyState
          title={d.title}
          description={
            <>
              <span>ID: {projectId}</span>
              <br />
              <span className="twix-muted">{d.message}</span>
              <GuardCrmLinks />
            </>
          }
        />
      </div>
    );
  }

  if (versionQuery.isError) {
    const d = describeLoadError(versionQuery.error, 'Версия не загружена');
    return (
      <div style={{ height: '100vh', padding: 24 }}>
        <EmptyState
          title={d.title}
          description={d.message}
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--twix-border)',
              background: viewMode === '2d' ? '#0f172a' : '#fff',
              color: viewMode === '2d' ? '#fff' : '#0f172a',
            }}
            onClick={() => setViewMode('2d')}
          >
            2D
          </button>
          <button
            type="button"
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--twix-border)',
              background: viewMode === '3d' ? '#0f172a' : '#fff',
              color: viewMode === '3d' ? '#fff' : '#0f172a',
            }}
            onClick={() => setViewMode('3d')}
          >
            3D
          </button>
        </div>
        {modelEmpty ? (
          <div style={{ flex: 'none' }}>
            <EmptyState
              title="Пустая модель"
              description={
                <>
                  Быстрый старт этажей (без стен) или добавьте этаж в списке слева, затем инструмент «Стена».
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      style={{ fontSize: 13, padding: '6px 12px' }}
                      onClick={() => {
                        if (!draft || draft.floors.length > 0) return;
                        const f = createFloor({
                          label: '1 этаж',
                          level: 1,
                          elevationMm: 0,
                          heightMm: DEFAULT_FLOOR_HEIGHT_MM,
                          floorType: 'full',
                          sortIndex: 0,
                        });
                        if (applyCommand({ type: 'addFloor', floor: f }).ok) setActiveFloor(f.id);
                      }}
                    >
                      Шаблон: 1 этаж
                    </button>
                    <button
                      type="button"
                      style={{ fontSize: 13, padding: '6px 12px' }}
                      onClick={() => {
                        if (!draft || draft.floors.length > 0) return;
                        const f1 = createFloor({
                          label: '1 этаж',
                          level: 1,
                          elevationMm: 0,
                          heightMm: DEFAULT_FLOOR_HEIGHT_MM,
                          floorType: 'full',
                          sortIndex: 0,
                        });
                        const f2 = createFloor({
                          label: '2 этаж',
                          level: 2,
                          elevationMm: DEFAULT_FLOOR_HEIGHT_MM,
                          heightMm: DEFAULT_FLOOR_HEIGHT_MM,
                          floorType: 'full',
                          sortIndex: 1,
                        });
                        if (applyCommand({ type: 'addFloor', floor: f1 }).ok) {
                          if (applyCommand({ type: 'addFloor', floor: f2 }).ok) setActiveFloor(f2.id);
                        }
                      }}
                    >
                      Шаблон: 2 этажа
                    </button>
                  </div>
                </>
              }
            />
          </div>
        ) : null}
        {viewMode === '2d' ? (
          <EditorCanvas2D
            onRegisterFitView={(fn) => {
              fitViewRef.current = fn;
            }}
          />
        ) : (
          <ErrorBoundary scope="preview3d">
            <Preview3DPanel model={draft} activeFloorId={view.activeFloorId} />
          </ErrorBoundary>
        )}
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
            <BuildingSummaryPanel />
            <BuildingWarningsPanel />
            <PanelizationPanel />
            <SpecPanel />
            <ExportPanel
              projectId={projectId}
              versionId={version?.id ?? null}
              onSaveBeforeExport={saveBeforeExport}
            />
            <ImportReviewPanel
              projectId={projectId}
              versionMarkers={
                document.currentVersionId !== null &&
                document.currentVersionNumber !== null &&
                document.schemaVersion !== null
                  ? {
                      expectedCurrentVersionId: document.currentVersionId,
                      expectedVersionNumber: document.currentVersionNumber,
                      expectedSchemaVersion: document.schemaVersion,
                    }
                  : null
              }
            />
            <ImportApplyHistoryPanel projectId={projectId} />
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

            {selection.selectedObjectType === 'opening' ? (
              <OpeningInspector />
            ) : selection.selectedObjectType === 'roof' ? (
              <RoofInspector />
            ) : selection.selectedObjectType === 'slab' ? (
              <SlabInspector />
            ) : selection.selectedObjectType === 'wall' ? (
              <WallInspector />
            ) : activePanel === 'roof' ? (
              <RoofInspector />
            ) : activePanel === 'slabs' ? (
              <SlabInspector />
            ) : (
              <FloorInspector />
            )}

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
