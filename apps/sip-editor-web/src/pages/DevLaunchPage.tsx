import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rememberSipUserId } from '@/identity/sipUser';
import { buildSipEditorProjectUrl } from '@/routes/sipEditorUrl';

const LS_PROJECT = 'sip_editor_dev_last_project_id';
const LS_USER = 'sip_editor_dev_last_user_id';

export function DevLaunchPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState('');
  const [sipUserId, setSipUserId] = useState('');

  useEffect(() => {
    setProjectId(localStorage.getItem(LS_PROJECT) ?? '');
    setSipUserId(localStorage.getItem(LS_USER) ?? '');
  }, []);

  const openEditor = useCallback(() => {
    const pid = projectId.trim();
    const uid = sipUserId.trim();
    if (!pid || !uid) return;
    rememberSipUserId(uid);
    localStorage.setItem(LS_PROJECT, pid);
    localStorage.setItem(LS_USER, uid);
    navigate(`/sip-editor/${encodeURIComponent(pid)}`);
  }, [navigate, projectId, sipUserId]);

  const openLast = useCallback(() => {
    const pid = localStorage.getItem(LS_PROJECT)?.trim() ?? '';
    const uid = localStorage.getItem(LS_USER)?.trim() ?? '';
    if (!pid || !uid) return;
    setProjectId(pid);
    setSipUserId(uid);
    rememberSipUserId(uid);
    navigate(`/sip-editor/${encodeURIComponent(pid)}`);
  }, [navigate]);

  const exampleUrl = buildSipEditorProjectUrl(
    '<projectId>',
    '<sipUserId>',
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
  );

  return (
    <div className="twix-ui" style={{ padding: 24, maxWidth: 520, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>SIP Editor — dev launch</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
        Введите идентификаторы и откройте редактор без CRM. UID должен совпадать с тем, что ожидает SIP API
        (заголовок <code style={{ fontSize: 12 }}>x-sip-user-id</code>).
      </p>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>projectId</label>
      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="UUID проекта"
        style={{
          width: '100%',
          marginBottom: 12,
          padding: 8,
          fontSize: 13,
          border: '1px solid #e2e8f0',
          borderRadius: 6,
        }}
      />
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>sipUserId (Firebase UID)</label>
      <input
        value={sipUserId}
        onChange={(e) => setSipUserId(e.target.value)}
        placeholder="тот же UID, что в CRM"
        style={{
          width: '100%',
          marginBottom: 12,
          padding: 8,
          fontSize: 13,
          border: '1px solid #e2e8f0',
          borderRadius: 6,
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={openEditor}
          disabled={!projectId.trim() || !sipUserId.trim()}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Открыть редактор
        </button>
        <button
          type="button"
          onClick={openLast}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Открыть последние (localStorage)
        </button>
        <Link to="/sip-editor/projects" style={{ alignSelf: 'center', fontSize: 13, color: '#2563eb' }}>
          Список проектов
        </Link>
        <Link to="/sip-editor" style={{ alignSelf: 'center', fontSize: 13, color: '#2563eb' }}>
          Назад
        </Link>
      </div>
      <p style={{ marginTop: 20, fontSize: 12, color: '#64748b' }}>
        Пример валидного URL: <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{exampleUrl}</code>
      </p>
    </div>
  );
}
