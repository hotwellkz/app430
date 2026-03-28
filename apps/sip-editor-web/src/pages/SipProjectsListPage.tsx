import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProjects } from '@/api/projectsApi';
import { rememberSipUserId } from '@/identity/sipUser';

const LS_USER = 'sip_editor_dev_last_user_id';

export function SipProjectsListPage() {
  const [sipUserId, setSipUserId] = useState('');
  const [templatesFilter, setTemplatesFilter] = useState<'all' | 'only' | 'hide'>(
    'all'
  );

  useEffect(() => {
    setSipUserId(localStorage.getItem(LS_USER) ?? '');
  }, []);

  const q = useQuery({
    queryKey: ['sip-projects-list', sipUserId, templatesFilter],
    queryFn: () => listProjects({ limit: 80, templates: templatesFilter }),
    enabled: sipUserId.trim().length > 0,
  });

  const applyUid = useCallback(() => {
    const uid = sipUserId.trim();
    if (!uid) return;
    rememberSipUserId(uid);
    localStorage.setItem(LS_USER, uid);
    void q.refetch();
  }, [sipUserId, q]);

  return (
    <div className="twix-ui" style={{ padding: 24, maxWidth: 720, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>SIP-проекты</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
        Список проектов текущего пользователя (заголовок <code style={{ fontSize: 12 }}>x-sip-user-id</code>).
        Шаблоны отмечены; откройте проект и используйте «Сохранить как», чтобы получить независимую копию.
      </p>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>sipUserId (Firebase UID)</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12,
        alignItems: 'center',
      }}>
        <input
          value={sipUserId}
          onChange={(e) => setSipUserId(e.target.value)}
          placeholder="UID"
          style={{
            flex: '1 1 200px',
            padding: 8,
            fontSize: 13,
            border: '1px solid #e2e8f0',
            borderRadius: 6,
          }}
        />
        <button
          type="button"
          onClick={applyUid}
          disabled={!sipUserId.trim()}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: sipUserId.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Загрузить список
        </button>
      </div>
      <div style={{ marginBottom: 12, fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span className="twix-muted">Шаблоны:</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="radio"
            name="tf"
            checked={templatesFilter === 'all'}
            onChange={() => setTemplatesFilter('all')}
          />
          все
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="radio"
            name="tf"
            checked={templatesFilter === 'only'}
            onChange={() => setTemplatesFilter('only')}
          />
          только шаблоны
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="radio"
            name="tf"
            checked={templatesFilter === 'hide'}
            onChange={() => setTemplatesFilter('hide')}
          />
          без шаблонов
        </label>
      </div>

      {q.isLoading ? <p style={{ fontSize: 14 }}>Загрузка…</p> : null}
      {q.isError ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>
          {(q.error as Error)?.message ?? 'Ошибка'}
        </p>
      ) : null}

      {q.data?.projects?.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {q.data.projects.map((p) => {
            const to =
              sipUserId.trim().length > 0
                ? `/sip-editor/${encodeURIComponent(p.id)}?sipUserId=${encodeURIComponent(sipUserId.trim())}`
                : `/sip-editor/${encodeURIComponent(p.id)}`;
            return (
              <li
                key={p.id}
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  padding: '10px 0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Link
                  to={to}
                  style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}
                >
                  {p.title || 'Без названия'}
                </Link>
                {p.isTemplate ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#e0e7ff',
                      color: '#3730a3',
                    }}
                  >
                    шаблон
                  </span>
                ) : null}
                <span style={{ fontSize: 12, color: '#64748b' }}>{p.id.slice(0, 8)}…</span>
              </li>
            );
          })}
        </ul>
      ) : q.isSuccess && sipUserId.trim() ? (
        <p style={{ fontSize: 14, color: '#64748b' }}>Проектов нет.</p>
      ) : null}

      <p style={{ marginTop: 20, fontSize: 13 }}>
        <Link to="/sip-editor/dev-launch" style={{ color: '#2563eb' }}>
          Dev-launch
        </Link>
        {' · '}
        <Link to="/sip-editor" style={{ color: '#2563eb' }}>
          Назад
        </Link>
      </p>
    </div>
  );
}
