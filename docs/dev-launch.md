# Как открыть SIP Editor

## Из CRM (основной сценарий)

### Раздел «SIP Проекты» (`/sip-projects`)

1. В левом меню CRM выберите **SIP Проекты**.
2. Список подгружается через `GET /api/projects` с заголовком **`x-sip-user-id`** (Firebase UID берётся из текущей сессии CRM, вручную query не нужен).
3. **Создать проект** / **Создать тестовый проект** — POST `/api/projects`, затем открытие редактора в **новой вкладке** с URL, собранным хелпером **`buildSipEditorUrl(projectId, uid)`** (`src/lib/sip/sipEditorUrl.ts`).
4. **Открыть последний проект** — из `localStorage` (`crm_sip_last_project_id`).
5. Поиск по списку — по названию и `dealId` (клиентская фильтрация по уже загруженным строкам).

### Карточка сделки

В сайдбаре сделки блок **SIP проект**:

- нет `sipEditorProjectId` — **Создать SIP-проект** (создание + запись id в сделку + открытие редактора);
- есть — метаданные из **`GET /api/projects/:id`** (при доступе) и **Открыть SIP Editor**.

### Шапка воронки сделок

Ссылка **SIP Проекты** ведёт на тот же маршрут `/sip-projects`.

### Legacy: `/integrations/sip-editor`

Страница сохранена для отладки и сценария `?dealId=<id>`, но основной UX — **`/sip-projects`**.

URL редактора после открытия:

`{VITE_SIP_EDITOR_ORIGIN}/sip-editor/<projectId>?sipUserId=<uid>`

Переменные окружения CRM: **`VITE_SIP_EDITOR_ORIGIN`**, **`VITE_SIP_API_BASE_URL`**, опционально **`VITE_CRM_ORIGIN`** (для ссылок из приложения редактора, если origin другой) — см. `.env.example`.

Важно:

- в `DEV` допустим fallback на `http://localhost:5174`;
- в `PRODUCTION` fallback на localhost запрещен — при отсутствии `VITE_SIP_EDITOR_ORIGIN` UI покажет ошибку конфигурации `SIP Editor production URL не настроен`.

## Быстрый runtime-checklist

1. В URL редактора есть path `/sip-editor/<projectId>`.
2. В query есть `sipUserId`, либо UID уже сохранён в session/local storage.
3. CRM env: `VITE_SIP_API_BASE_URL=/sip-editor-api`.
4. Netlify redirects содержат правило `/sip-editor-api/*` (выше catch-all `/* /index.html 200`).
5. `GET /health` и `GET /health/details` на API отвечают предсказуемо.

## Dev-launch (без CRM)

В приложении **`sip-editor-web`**:

- Страница **`/sip-editor/dev-launch`**: поля `projectId` и `sipUserId`, кнопка **«Открыть редактор»**, **«Открыть последние»** (читает последние значения из `localStorage`).
- UID сохраняется в **`sessionStorage`** (тот же ключ, что и у `?sipUserId=`), чтобы API-запросы шли с заголовком **`x-sip-user-id`**.

## Прямой URL

1. Откройте **`/sip-editor/<projectId>?sipUserId=<uid>`** на origin редактора (или задайте uid на dev-launch, затем переход на проект).
2. Без `sipUserId` редактор покажет guard-экран с кнопками перехода в CRM (**SIP Проекты**) и dev-подсказкой только в **`import.meta.env.DEV`**.
3. Без `projectId` в пути — экран **`/sip-editor`** с подсказкой и ссылками.

Хелперы URL:

- CRM: **`buildSipEditorUrl`**, **`buildCrmSipProjectsUrl`** — `src/lib/sip/sipEditorUrl.ts`.
- Web-редактор: **`crmSipProjectsUrl()`** — `apps/sip-editor-web/src/routes/crmEntry.ts`; проект — **`buildSipEditorProjectUrl`** в `apps/sip-editor-web/src/routes/sipEditorUrl.ts`.

Hook: **`useCurrentSipUser()`** — `src/hooks/useCurrentSipUser.ts` (обёртка над CRM auth).
