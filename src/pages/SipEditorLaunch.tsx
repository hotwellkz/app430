import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getDealById, updateDeal } from '../lib/firebase/deals';
import type { Deal } from '../types/deals';
import { buildSipEditorUrl } from '../lib/sip/sipEditorUrl';
import { getSipApiBase } from '../lib/sip/sipEnv';

interface ApiErr {
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Точка входа CRM → SIP-редактор: создание проекта, привязка к сделке, deep link с user id.
 */
export const SipEditorLaunch: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get('dealId')?.trim() ?? '';
  const projectIdFromUrl = searchParams.get('projectId')?.trim() ?? '';

  const [projectId, setProjectId] = useState('');
  const [dealId, setDealId] = useState(dealIdFromUrl);
  const [linkedDeal, setLinkedDeal] = useState<Deal | null>(null);
  const [loadingDeal, setLoadingDeal] = useState(false);
  const [title, setTitle] = useState('SIP-проект');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDealId(dealIdFromUrl);
  }, [dealIdFromUrl]);

  useEffect(() => {
    if (projectIdFromUrl) {
      setProjectId(projectIdFromUrl);
    }
  }, [projectIdFromUrl]);

  const loadDeal = useCallback(async (id: string) => {
    if (!id) {
      setLinkedDeal(null);
      return;
    }
    setLoadingDeal(true);
    setMessage(null);
    try {
      const d = await getDealById(id);
      setLinkedDeal(d);
      if (!d) {
        setMessage('Сделка не найдена');
      } else if (d.title) {
        setTitle((t) => (t === 'SIP-проект' ? `SIP: ${d.title}` : t));
      }
    } catch (e) {
      setLinkedDeal(null);
      setMessage(e instanceof Error ? e.message : 'Ошибка загрузки сделки');
    } finally {
      setLoadingDeal(false);
    }
  }, []);

  useEffect(() => {
    void loadDeal(dealId.trim());
  }, [dealId, loadDeal]);

  const openEditor = (id: string) => {
    if (!user?.uid) {
      setMessage('Войдите в CRM, чтобы открыть редактор');
      return;
    }
    window.open(buildSipEditorUrl(id, user.uid), '_blank', 'noopener,noreferrer');
  };

  const sipHeaders = (): HeadersInit => {
    if (!user?.uid) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'x-sip-user-id': user.uid,
    };
  };

  const handleOpen = () => {
    const id = projectId.trim();
    if (!id) {
      setMessage('Введите projectId');
      return;
    }
    setMessage(null);
    openEditor(id);
  };

  const handleOpenLinked = () => {
    const id = linkedDeal?.sipEditorProjectId?.trim();
    if (!id) return;
    setProjectId(id);
    openEditor(id);
  };

  const handleCreate = async () => {
    if (!user?.uid) {
      setMessage('Войдите в CRM');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const base = getSipApiBase();
      const res = await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: sipHeaders(),
        body: JSON.stringify({
          title: title.trim() || undefined,
          dealId: dealId.trim() || null,
          createdBy: user.uid,
        }),
      });
      const data = (await res.json()) as {
        project?: { id: string };
      } & ApiErr;
      if (!res.ok) {
        setMessage(data.message ?? `Ошибка ${res.status}`);
        return;
      }
      if (!data.project?.id) {
        setMessage('Некорректный ответ API');
        return;
      }
      const pid = data.project.id;
      setProjectId(pid);
      const dId = dealId.trim();
      if (dId) {
        try {
          await updateDeal(dId, { sipEditorProjectId: pid });
          await loadDeal(dId);
        } catch (e) {
          setMessage(
            `Проект создан (${pid}), но не удалось записать sipEditorProjectId в сделку: ${e instanceof Error ? e.message : String(e)}`
          );
          openEditor(pid);
          return;
        }
      }
      openEditor(pid);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Сеть / CORS');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">Загрузка профиля…</div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <p className="text-red-600 text-sm">Войдите в систему, чтобы работать с SIP-редактором.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
        <strong className="font-medium">Основной вход:</strong>{' '}
        <Link to="/sip-projects" className="text-indigo-700 underline font-medium hover:text-indigo-900">
          SIP Проекты
        </Link>
        — список, создание и открытие редактора без ручного URL. Эта страница оставлена для отладки и сценария с{' '}
        <code className="text-xs bg-white/80 px-1 rounded border border-indigo-100">?dealId=</code>.
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">SIP Editor (legacy launch)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Отдельное приложение. Запросы к API идут с заголовком{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">x-sip-user-id</code> (ваш UID:{' '}
          <span className="font-mono text-xs">{user.uid.slice(0, 8)}…</span>).
        </p>
      </div>

      <div className="space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50/80">
        <label className="block text-sm font-medium text-gray-700">Сделка (dealId)</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          placeholder="Вставьте ID сделки или откройте страницу с ?dealId=…"
        />
        {loadingDeal ? (
          <p className="text-xs text-gray-500">Загрузка сделки…</p>
        ) : linkedDeal?.sipEditorProjectId ? (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-gray-700">
              У сделки уже есть SIP-проект:{' '}
              <code className="text-xs bg-white px-1 border rounded">
                {linkedDeal.sipEditorProjectId}
              </code>
            </p>
            <button
              type="button"
              onClick={handleOpenLinked}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Открыть SIP Editor
            </button>
          </div>
        ) : linkedDeal ? (
          <p className="text-xs text-gray-500 pt-1">SIP-проект ещё не привязан — создайте ниже.</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">projectId (вручную)</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="uuid из Firestore / ответа POST /api/projects"
        />
        <button
          type="button"
          onClick={handleOpen}
          className="w-full py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900"
        >
          Открыть SIP Editor (вручную по projectId)
        </button>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Новый проект
        </p>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate()}
          className="w-full py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Создание…' : 'Создать проект и открыть SIP Editor'}
        </button>
      </div>

      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      <p className="text-xs text-gray-500">
        Переменные: <code className="bg-gray-100 px-1 rounded">VITE_SIP_EDITOR_ORIGIN</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">VITE_SIP_API_BASE_URL</code> — см. корневой{' '}
        <code className="bg-gray-100 px-1 rounded">.env.example</code>.
      </p>
    </div>
  );
};
