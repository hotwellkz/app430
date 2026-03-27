# SIP Editor Source Of Truth

## Что рендерит SIP Editor

- Реальный UI SIP Editor находится в приложении `apps/sip-editor-web`.
- Ключевой маршрут редактора: `/sip-editor/:projectId`.
- Toolbar с кнопками `Сохранить`, `Новая версия`, `Импорт по фото/планам` рендерится компонентом `apps/sip-editor-web/src/components/EditorToolbar.tsx`.
- Страница, которая подключает toolbar и мастер AI-импорта: `apps/sip-editor-web/src/pages/EditorShellPage.tsx`.

## Как CRM открывает редактор

- CRM (корневое приложение) не рендерит сам редактор внутри `https://2wix.ru`.
- CRM формирует внешний URL через `src/lib/sip/sipEditorUrl.ts` (`buildSipEditorUrl`).
- Итоговый origin берется из `VITE_SIP_EDITOR_ORIGIN`.

## Обязательное правило для production

- `VITE_SIP_EDITOR_ORIGIN` должен указывать на deploy приложения `apps/sip-editor-web`.
- **Отдельный Netlify-сайт для редактора** обязан иметь тот же прокси SIP API, что и CRM: `GET /sip-editor-api/*` → Cloud Run (см. `apps/sip-editor-web/netlify.toml`). Иначе в сборке с пустым `VITE_API_BASE_URL` запросы уйдут на `/api/*` на origin редактора → 404 → в UI ошибка «Версия не загружена» / «нет данных current-version» при **живом** backend.
- CLI: при деплое из монорепозитория используйте **`netlify deploy --dir` с абсолютным путём к `apps/sip-editor-web/dist`** и `--no-build`, иначе CLI может взять корневой `dist` CRM.
- В билде редактора для Netlify задайте `VITE_API_BASE_URL=/sip-editor-api` (уже в `netlify.toml` приложения).
- Backend deploy не нужен для проверки факта отображения кнопки в toolbar.
- Если кнопка не видна, сначала проверяйте:
  1) какой URL editor реально открыт в браузере;
  2) какой deploy/commit у этого origin;
  3) совпадает ли он с последним deploy `apps/sip-editor-web`.
