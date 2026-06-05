import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/serviceWorker';
import { validateSipEnv } from './lib/sip/sipEnv';
import { applyInitialTheme } from './hooks/useTheme';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

applyInitialTheme();
validateSipEnv();

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Регистрируем Service Worker после инициализации приложения
registerServiceWorker();