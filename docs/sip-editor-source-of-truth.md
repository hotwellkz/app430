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
- Backend deploy не нужен для проверки факта отображения кнопки в toolbar.
- Если кнопка не видна, сначала проверяйте:
  1) какой URL editor реально открыт в браузере;
  2) какой deploy/commit у этого origin;
  3) совпадает ли он с последним deploy `apps/sip-editor-web`.
