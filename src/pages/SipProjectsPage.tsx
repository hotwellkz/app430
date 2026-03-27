import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Dialog, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ExternalLink, Layers, MoreHorizontal, Plus, RefreshCw, Search } from 'lucide-react';
import { useCurrentSipUser } from '../hooks/useCurrentSipUser';
import { openSipEditorWindow } from '../lib/sip/sipEditorUrl';
import { SipApiError, sipCreateProject, sipDeleteProject, sipListProjects } from '../lib/sip/sipApi';
import type { SipProjectRow } from '../lib/sip/sipTypes';

const LS_LAST_PROJECT = 'crm_sip_last_project_id';

const STATUS_RU: Record<string, string> = {
  draft: 'Черновик',
  calculated: 'Рассчитан',
  reviewed: 'На проверке',
  approved: 'Утверждён',
};

function formatDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function openEditorTab(projectId: string, uid: string): void {
  localStorage.setItem(LS_LAST_PROJECT, projectId);
  openSipEditorWindow(projectId, uid);
}

export const SipProjectsPage: React.FC = () => {
  const { sipUserId, loading: authLoading, isAuthenticated } = useCurrentSipUser();
  const [projects, setProjects] = useState<SipProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SipProjectRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sipUserId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await sipListProjects(80);
      setProjects(list);
    } catch (e) {
      const msg =
        e instanceof SipApiError
          ? e.status === 403
            ? 'Нет доступа к SIP-проектам'
            : e.status === 503 || e.status === 504
              ? 'SIP API недоступен. Проверьте backend/proxy и повторите.'
              : e.message
          : e instanceof Error
            ? e.message
            : 'Не удалось загрузить список';
      setError(msg);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [sipUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.dealId && p.dealId.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
    );
  }, [projects, query]);

  const searchActive = query.trim().length > 0;
  const showSearchEmpty = !loading && !error && projects.length > 0 && filtered.length === 0 && searchActive;
  const showGlobalEmpty = !loading && !error && projects.length === 0;

  const tryOpenEditor = (projectId: string) => {
    if (!sipUserId) return;
    try {
      openEditorTab(projectId, sipUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SIP Editor production URL не настроен');
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete || !sipUserId) return;
    const id = confirmDelete.id;
    setDeletingId(id);
    try {
      await sipDeleteProject(id);
      toast.success('Проект удалён');
      setProjects((prev) => prev.filter((p) => p.id !== id));
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_LAST_PROJECT) === id) {
          localStorage.removeItem(LS_LAST_PROJECT);
        }
      } catch {
        /* ignore */
      }
      setConfirmDelete(null);
    } catch (e) {
      const msg =
        e instanceof SipApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Не удалось удалить проект';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const onCreateEmpty = async () => {
    if (!sipUserId) {
      toast.error('Войдите в систему');
      return;
    }
    setCreating(true);
    try {
      const { project } = await sipCreateProject({
        title: 'Новый SIP-проект',
        dealId: null,
        createdBy: sipUserId,
      });
      toast.success('Проект создан');
      await load();
      openEditorTab(project.id, sipUserId);
    } catch (e) {
      if (e instanceof SipApiError && (e.status === 503 || e.status === 504)) {
        toast.error('SIP API недоступен. Проект не создан.');
      } else {
        toast.error(e instanceof Error ? e.message : 'Ошибка создания');
      }
    } finally {
      setCreating(false);
    }
  };

  const onCreateTest = async () => {
    if (!sipUserId) {
      toast.error('Войдите в систему');
      return;
    }
    setCreatingTest(true);
    try {
      const { project } = await sipCreateProject({
        title: `Тестовый SIP-проект ${new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`,
        dealId: null,
        createdBy: sipUserId,
      });
      toast.success('Тестовый проект создан');
      await load();
      openEditorTab(project.id, sipUserId);
    } catch (e) {
      if (e instanceof SipApiError && (e.status === 503 || e.status === 504)) {
        toast.error('SIP API недоступен. Тестовый проект не создан.');
      } else {
        toast.error(e instanceof Error ? e.message : 'Ошибка создания');
      }
    } finally {
      setCreatingTest(false);
    }
  };

  const onOpenLast = () => {
    if (!sipUserId) {
      toast.error('Войдите в систему');
      return;
    }
    const id = localStorage.getItem(LS_LAST_PROJECT)?.trim();
    if (!id) {
      toast.error('Нет сохранённого проекта');
      return;
    }
    try {
      openEditorTab(id, sipUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SIP Editor production URL не настроен');
    }
  };

  const lastId = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_LAST_PROJECT)?.trim() : null;

  if (authLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Загрузка…</p>
      </div>
    );
  }

  if (!isAuthenticated || !sipUserId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-xl font-semibold text-gray-900">SIP Проекты</h1>
        <p className="mt-2 text-sm text-red-600">Войдите в CRM, чтобы работать с проектами.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      <header className="flex-none bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">SIP Проекты</h1>
              <p className="text-xs text-slate-500 truncate">
                Редактор открывается в новой вкладке с вашим UID — ручной ввод sipUserId не нужен.
              </p>
              {!loading && !error && (
                <p className="text-xs text-slate-600 mt-1" data-testid="sip-projects-count">
                  Проектов: {projects.length}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            <button
              type="button"
              onClick={onOpenLast}
              disabled={!lastId}
              title={lastId ? `Последний: ${lastId.slice(0, 8)}…` : undefined}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть последний
            </button>
            <button
              type="button"
              onClick={() => void onCreateTest()}
              disabled={creatingTest}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creatingTest ? 'Создание…' : 'Тестовый проект'}
            </button>
            <button
              type="button"
              onClick={() => void onCreateEmpty()}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Создание…' : 'Создать проект'}
            </button>
          </div>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, id сделки или проекта…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
            <p className="font-semibold">Не удалось загрузить проекты</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 text-sm font-medium text-red-900 underline"
            >
              Повторить
            </button>
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-500">Загрузка списка…</p>
        ) : showSearchEmpty ? (
          <div
            className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            data-testid="sip-search-empty"
          >
            <p className="font-medium text-slate-800">Ничего не найдено</p>
            <p className="mt-1 text-sm text-slate-600">Попробуйте изменить запрос или сбросить поиск.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Сбросить поиск
            </button>
          </div>
        ) : showGlobalEmpty ? (
          <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="sip-global-empty">
            <p className="font-medium text-slate-800">Проектов пока нет</p>
            <p className="mt-1 text-sm text-slate-600">
              Создайте проект или тестовый проект — редактор откроется автоматически.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onCreateEmpty()}
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Создать проект
              </button>
              <button
                type="button"
                onClick={() => void onCreateTest()}
                disabled={creatingTest}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Создать тестовый проект
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Сделка</th>
                  <th className="px-4 py-3">Обновлён</th>
                  <th className="px-4 py-3">Автор / правки</th>
                  <th className="px-4 py-3 w-[200px] text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const rowBusy = deletingId === p.id;
                  return (
                    <tr
                      key={p.id}
                      data-testid={`sip-project-row-${p.id}`}
                      className={`border-b border-slate-100 hover:bg-slate-50/80 ${rowBusy ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.title}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{p.id.slice(0, 10)}…</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{STATUS_RU[p.status] ?? p.status}</td>
                      <td className="px-4 py-3">
                        {p.dealId ? (
                          <span className="text-emerald-700 font-mono text-xs">{p.dealId.slice(0, 12)}…</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDt(p.updatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        <div>созд.: {p.createdBy ? `${p.createdBy.slice(0, 8)}…` : '—'}</div>
                        <div>изм.: {p.updatedBy ? `${p.updatedBy.slice(0, 8)}…` : '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            data-testid={`sip-open-${p.id}`}
                            onClick={() => tryOpenEditor(p.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Открыть
                          </button>
                          <Menu as="div" className="relative inline-block text-left">
                            <MenuButton
                              type="button"
                              disabled={rowBusy}
                              data-testid={`sip-actions-${p.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              aria-label="Действия с проектом"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </MenuButton>
                            <MenuItems
                              anchor="bottom end"
                              modal={false}
                              className="z-40 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg outline-none [--anchor-gap:4px]"
                            >
                              <MenuItem>
                                {({ focus }) => (
                                  <button
                                    type="button"
                                    className={`${focus ? 'bg-slate-50' : ''} flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800`}
                                    onClick={() => tryOpenEditor(p.id)}
                                  >
                                    Открыть
                                  </button>
                                )}
                              </MenuItem>
                              <MenuItem>
                                {({ focus }) => (
                                  <button
                                    type="button"
                                    data-testid={`sip-delete-trigger-${p.id}`}
                                    className={`${focus ? 'bg-red-50' : ''} flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700`}
                                    onClick={() => setConfirmDelete(p)}
                                  >
                                    Удалить проект
                                  </button>
                                )}
                              </MenuItem>
                            </MenuItems>
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && projects.length > 0 && !showSearchEmpty && (
          <p className="mt-4 text-xs text-slate-500">
            Показано: {filtered.length} из {projects.length}
          </p>
        )}
      </div>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => {
          if (deletingId) return;
          setConfirmDelete(null);
        }}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">Удалить проект?</Dialog.Title>
            <p className="mt-2 text-sm text-slate-600">
              Проект будет удалён полностью из системы. Восстановить данные будет нельзя.
            </p>
            {confirmDelete && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                <p className="font-medium">{confirmDelete.title}</p>
                <p className="mt-1 font-mono text-xs text-slate-500 break-all">ID: {confirmDelete.id}</p>
                {confirmDelete.dealId ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">Сделка: {confirmDelete.dealId}</p>
                ) : null}
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                data-testid="sip-delete-cancel"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                data-testid="sip-delete-confirm"
                disabled={Boolean(deletingId)}
                onClick={() => void onConfirmDelete()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};
