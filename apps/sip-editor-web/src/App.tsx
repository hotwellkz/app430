import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { DevLaunchPage } from '@/pages/DevLaunchPage';
import { EditorShellPage } from '@/pages/EditorShellPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/sip-editor" replace />} />
        <Route
          path="/sip-editor"
          element={
            <div style={{ padding: 24, fontFamily: 'system-ui' }}>
              <h1 style={{ fontSize: 18 }}>SIP Editor</h1>
              <p style={{ color: '#52525b' }}>
                Нужен адрес с <code>projectId</code> и параметром <code>sipUserId</code>, либо вход из CRM.
              </p>
              <p style={{ color: '#52525b', fontSize: 14 }}>
                Пример:{' '}
                <code style={{ fontSize: 12 }}>
                  /sip-editor/&lt;projectId&gt;?sipUserId=&lt;uid&gt;
                </code>
              </p>
              <p style={{ marginTop: 12 }}>
                <Link to="/sip-editor/dev-launch" style={{ color: '#2563eb' }}>
                  Dev-launch — ввести projectId и uid вручную
                </Link>
              </p>
            </div>
          }
        />
        <Route path="/sip-editor/dev-launch" element={<DevLaunchPage />} />
        <Route path="/sip-editor/:projectId" element={<EditorShellPage />} />
        <Route path="*" element={<Navigate to="/sip-editor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
