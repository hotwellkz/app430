import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, ExternalLink, Plus, RefreshCw, Search } from 'lucide-react';
import { useCurrentSipUser } from '../hooks/useCurrentSipUser';
import { buildSipEditorUrl } from '../lib/sip/sipEditorUrl';
import { SipApiError, sipCreateProject, sipListProjects } from '../lib/sip/sipApi';
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
  const url = buildSipEditorUrl(projectId, uid);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const SipProjectsPage: React.FC = () => {
  const { sipUserId, loading: authLoading, isAuthenticated } = useCurrentSipUser();
  const [projects, setProjects] = useState<SipProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);

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
      toast.error(e instanceof Error ? e.message : 'Ошибка создания');
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
      toast.error(e instanceof Error ? e.message : 'Ошибка создания');
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
    openEditorTab(id, sipUserId);
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
        ) : filtered.length === 0 ? (
          <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-medium text-slate-800">Пока нет проектов</p>
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
                  <th className="px-4 py-3 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
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
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditorTab(p.id, sipUserId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Показано: {filtered.length} из {projects.length}
          </p>
        )}
      </div>
    </div>
  );
};
