# Технические решения — SIP Editor

## Почему monorepo без переноса CRM в `apps/crm-web`

Существующее CRM-приложение (Vite, Netlify, тысячи импортов) оставлено **в корне репозитория** как workspace-пакет `.` в `pnpm-workspace.yaml`. Так мы:

- не ломаем пути, `netlify.toml` и привычные команды `pnpm dev` / `pnpm build` для CRM;
- всё равно получаем изолированные `apps/sip-editor-web` и `apps/api` + общие `packages/*`.

При желании позже можно перенести CRM в `apps/crm-web` одним миграционным PR.

## Граница CRM ↔ Editor

- **CRM** не импортирует React-компоненты редактора.
- **Основной launch flow:** раздел **`/sip-projects`** — список проектов текущего пользователя (`GET /api/projects`), создание (`POST /api/projects`), открытие редактора в новой вкладке через **`buildSipEditorUrl(projectId, uid)`** (`src/lib/sip/sipEditorUrl.ts`). UID всегда из CRM auth (`useAuth` / **`useCurrentSipUser`**), без ручного ввода в адресную строку.
- **Бизнес-вход:** карточка сделки — блок SIP (создание проекта + `sipEditorProjectId` на сделке, открытие того же URL).
- **`/integrations/sip-editor`** не является главной точкой входа: это **внутренний модуль**, не внешняя интеграция; страница на интеграциях оставлена как legacy/отладка (`?dealId=`).
- В dev CRM проксирует **`/sip-editor-api`** на Fastify `:3001` (`vite.config.ts`).

### Runtime hardening (stabilization sprint)

- Введены централизованные env helpers:
  - CRM: `src/lib/sip/sipEnv.ts`
  - sip-editor-web: `apps/sip-editor-web/src/config/env.ts`
  - API: `apps/api/src/config/env.ts`
- Принцип: fail-fast на некорректных env (не молчаливые падения в runtime).
- Entry/context устойчивость:
  - `sipUserId` берётся из query и сохраняется в session;
  - добавлен fallback из localStorage для повторных открытий/перезагрузок;
  - диагностика источника context (`query/session/localStorage`).
- Error boundaries:
  - shell-boundary для критических ошибок редактора;
  - отдельный boundary для 3D preview, чтобы падение preview не ломало 2D/shell.
- API observability:
  - `/health` и `/health/details`;
  - health делает реальные проверки Firestore и collections с timeout;
  - в прод `/health/details` скрывает лишние dev diagnostics.

## Временный auth bridge (`x-sip-user-id`)

**Текущее решение (dev / MVP):** все защищённые маршруты API требуют заголовок `x-sip-user-id` с Firebase UID пользователя CRM. CRM передаёт его на `fetch`; редактор читает `?sipUserId=` при открытии и кладёт в `sessionStorage`, затем добавляет заголовок ко всем запросам.

**Ограничения:** заголовок легко подделать вне браузера CRM. Это **не** production-grade auth.

**Следующий шаг hardening:** проверка Firebase ID token на API (`Authorization: Bearer`) или внутренний service-to-service secret + короткоживущие ссылки на редактор. Документировать rollout в отдельной задаче.

## Граница UI ↔ Firestore

- Клиент редактора **не** пишет в Firestore напрямую.
- Мутации только через **Fastify** + **firebase-admin**.

## Текущая рабочая версия (current version)

- В документе проекта хранятся `currentVersionId`, `currentVersionNumber`, `schemaVersion` (зеркало текущей версии), внутренний счётчик `versionCounter` (последний выделенный номер версии).
- **PATCH** `/current-version` обновляет **только** документ версии, на который указывает `currentVersionId`, плюс audit на проекте.
- **POST** `/versions` создаёт **новый** документ версии с `versionNumber = versionCounter + 1`, обновляет указатели current* и `versionCounter` в **одной транзакции** (после всех чтений, по правилам Firestore).

## Optimistic concurrency (PATCH)

Клиент передаёт `expectedCurrentVersionId`, `expectedVersionNumber`, `expectedSchemaVersion`. Сервер в транзакции сравнивает с фактическим состоянием. Расхождение → **409 CONFLICT** с `details`: `currentVersionId`, `currentVersionNumber`, `serverUpdatedAt`.

## Доступ к проекту

- Непустой `allowedEditorIds`: только перечисленные UID.
- Иначе, если задан `createdBy`: только он.
- Иначе (legacy без владельца): любой запрос с `x-sip-user-id` — временно для миграции старых документов.

Поля `createdBy` / `updatedBy` в теле запросов должны **совпадать** с `x-sip-user-id` (защита от несогласованности клиента).

## Синхронизация `BuildingModel.meta`

Функция `syncBuildingModelMeta` в `@2wix/domain-model` выравнивает `meta.projectId`, `meta.versionId`, `meta.versionNumber` (и при необходимости имя) при сохранении на сервере — единый источник правды относительно проекта и версии.

## Разделение `domain-model` / `editor-core` / `sip-editor-web`

- **`@2wix/domain-model`** — чистые типы не дублируются здесь; только фабрики, нормализация, валидация геометрии сущностей (`validateWall`, `addWallToModel`, …), утилиты модели (`cloneBuildingModel`, `compareBuildingModelsForDirtyCheck`, `getWallById`, …). Нет React, нет HTTP/Firestore.
- **`@2wix/editor-core`** — внутреннее состояние редактора: документ (server/draft, saveStatus), выделение, вид (zoom/pan/panel), **снимки истории только для `draftModel`**, диспетчер команд и Zustand-store (`useEditorStore`). Логика в чистых функциях (`reduceCommand` / `executeCommand`); API и персистенция остаются в приложении.
- **`sip-editor-web`** — React UI, TanStack Query, вызовы Fastify; переводит ответы API в `loadDocumentFromServer` / `applySaveSuccess` / `markSaveConflict` и не мутирует `BuildingModel` в обход команд.

### Draft vs server model

- **`serverModel`** — последнее согласованное с сервером состояние (после загрузки или успешного PATCH).
- **`draftModel`** — рабочая копия; любая редактирующая команда меняет только её. Флаг **`hasUnsavedChanges`** и **`saveStatus: "dirty"`** выводятся сравнением draft с server через `compareBuildingModelsForDirtyCheck`.
- **Сброс черновика** (`resetDraftToServer` / кнопка Discard): `draftModel = clone(serverModel)`, стеки undo/redo очищаются.

### История (undo/redo)

- Стеки **`past`** / **`future`** хранят **снимки `BuildingModel`** (не весь корень `EditorState`), с **лимитом глубины** (`DEFAULT_HISTORY_LIMIT`).
- Перед применением команды, мутирующей модель, текущий draft кладётся в `past`; `future` сбрасывается.
- Команды вида **zoom/pan/panel/grid/snap**, **`toolMode` (инструмент на canvas)** и **выделение** в историю **не попадают** — иначе undo «съедал бы» навигацию вместо геометрии.
- После **успешного сохранения** история очищается (новая базовая точка от сервера).
- Загрузка другой версии (`loadDocumentFromServer`) сбрасывает документ, историю и выделение; активная панель сайдбара по возможности сохраняется.

### Слой команд

Тип **`EditorCommand`** (discriminated union) описывает все операции. **`reduceCommand` / `executeCommand`** возвращают новое состояние и метаданные для store (нужно ли пушить снимок / сбросить историю). UI вызывает **`applyCommand`** на store или тонкие обёртки (`setZoom`, `selectObject`, `setToolMode`, …).

### 2D canvas (Sprint 4)

- **Технология:** **SVG** внутри React (`apps/sip-editor-web/src/canvas2d/`). Геометрия и сетка в **мировых мм**; преобразование экран ↔ мир — чистые функции (`worldToScreen`, `screenToWorld`, `snapPointToGrid`, wheel-zoom с `panToKeepWorldUnderScreenPoint`). Без Konva/Canvas: меньше зависимостей, достаточно для полилиний, hit-test и ручек.
- **Связь с ядром:** любое изменение стен — только **`addWall` / `updateWall` / `deleteWall`** и **`selectObject` / `clearSelection`** через store. Локальный state в компоненте ограничен **незавершённым жестом** (preview линии при рисовании, preview при перетаскивании конца до `pointerup`).
- **Hit-test:** расстояние от точки до **центральной линии** стены в мм; допуск **`~12px / zoom`** в мм, чтобы клик был комфортным при любом масштабе. Ручки концов — круги в мм с минимальным радиусом, зависящим от zoom.
- **Инструменты:** `view.toolMode`: `select` | `pan` | `draw-wall` | `draw-window` | `draw-door` | `draw-portal`. Режим хранится в **editor-core** (не в undo). После успешной второй точки **draw-wall** остаётся активным для серийного ввода; **Esc** сбрасывает незавершённый отрезок.
- **Проёмы (Sprint 5):** создание **одним кликом по стене** с размерами из доменных пресетов (`OPENING_DEFAULTS`) — быстрее двухкликового CAD-жеста и проще валидировать. Привязка к стене: **`wallId`** + **`positionAlongWall`** (центр проёма в мм от `start` стены); **`floorId`** денормализован для списков и синхронизируется из стены при `updateOpening`. Геометрия 2D-«выреза» — прямоугольник в плоскости этажа вдоль оси стены (см. `computeOpeningFootprintCorners` в `@2wix/domain-model`).
- **Joint-snap:** при отпускании ручки конца стены точка дополнительно притягивается к ближайшим `start`/`end` других стен этажа в небольшом радиусе (дополнение к сетке).

Подробнее: **`docs/2d-canvas.md`**, **`docs/openings.md`**.

### Этажи и дублирование (Sprint 6)

- **Разделение состояния:** `activeFloorId` живёт в **`view`** и меняется командой **`setActiveFloor`** без записи в undo — это навигация по уже загруженной модели, аналогично `toolMode` / zoom.
- **Дублирование этажа** сделано **одной доменной функцией** `duplicateFloorInModel`: копируются стены и проёмы с **новыми id** и согласованным remap `wallId` → иначе риск «висячих» проёмов. Предзаполнение `level` / `elevationMm` для копии: «над исходным» (`elevation + height`), имя с суффиксом «(копия)».
- **Удаление этажа:** каскад стен/проёмов в `deleteFloorFromModel`; запрет последнего этажа в **`tryDeleteFloorFromModel`** до вызова удаления. После undo/redo **`clampActiveFloorToModel`** устраняет ссылку на несуществующий этаж (раньше view мог указывать на id, которого нет в восстановленном черновике).
- Тип **`basement`** в `floorType` оставлен для цоколя/подвала; жёсткая автопроверка «отметка_i+1 = отметка_i + высота_i» не внедрялась в MVP (много исключений), вместо этого дублирование и шаблоны задают разумные дефолты.

Подробнее: **`docs/floors.md`**.

### Параметрические roof/slab вместо freeform (Sprint 7)

- Для MVP выбрана **параметрическая модель** перекрытий и крыши, а не свободный sketch/CAD-редактор:
  - меньше рисков сломать текущие wall/opening/floor флоу;
  - быстрее получить доменные данные, пригодные для расчёта и будущей 3D-генерации;
  - проще обеспечить undo/redo и сохранение через существующий current-version flow.
- Ограничения MVP намеренные:
  - slab: в простом режиме **одно перекрытие на этаж**;
  - roof: **одна основная крыша** на проект, привязка к верхнему этажу;
  - без сложных пересечений и freeform-полигонов.
- Эти ограничения сохраняют чистую миграционную дорожку к Sprint 8+:
  - 3D preview сможет использовать уже согласованные поля (`roofType`, `slopeDegrees`, `overhangMm`, `baseElevationMm`, `slabType`, `direction`);
  - vertical warnings подсказывают проблемы геометрии до перехода к 3D.

Подробнее: **`docs/vertical-model.md`**, **`docs/roof-and-slabs.md`**.

### 3D preview architecture (Sprint 8)

- Выбран стек **Three.js + react-three-fiber (+ drei OrbitControls)**:
  - интегрируется в текущий React shell без отдельного imperative-слоя;
  - достаточно для инженерного preview без фотореализма;
  - легче держать реактивную синхронизацию с `draftModel`.
- Принцип разделения:
  - `preview3d` adapter (`buildPreviewSceneModel`) выполняет геометрические вычисления;
  - React/three-компоненты только рендерят готовый snapshot и UI-контролы.
- Почему **не** heavy CSG для MVP:
  - boolean-операции часто нестабильны на «грязной» пользовательской геометрии;
  - сегментация стен на простые блоки (left/right/top/bottom) для проёмов предсказуема и тестируема;
  - проще поддерживать производительность и отказоустойчивость.
- Для стен/проёмов применена стратегия axis-segment + vertical-interval split:
  - стену режем по x-проекциям границ проёмов вдоль оси стены;
  - на каждом сегменте вырезаем вертикальные интервалы, оставшиеся части становятся box-мешами.
- 3D preview строится из `draftModel`, поэтому undo/redo/discard/save автоматически отражаются в viewer без отдельного состояния модели.

### Panel engine boundary (Sprint 9)

- Логика SIP-панелизации вынесена в отдельный package `@2wix/panel-engine`, а не в React/JSX и не в 3D renderer.
- Причины:
  - алгоритм должен быть детерминированным, тестируемым и переиспользуемым для будущих BOM/spec/export этапов;
  - UI остаётся потребителем snapshot, а не местом бизнес-расчёта;
  - проще развивать wall-first MVP без риска поломать canvas/preview.

### Почему generated panels = derived state

- Source of truth остаётся `BuildingModel` (`walls/openings/floors/settings`).
- `generatedPanels` пересчитываются на лету из `draftModel` и не пишутся как канонические данные в Firestore.
- Это снижает риск рассинхронизации и упрощает эволюцию алгоритма в следующих спринтах (BOM/spec/export).

### Почему roof/slab panelization отложены

- В Sprint 9 целенаправленно ограничен scope до walls-first:
  - быстрее получить устойчивый инженерный контур с warnings и overlay;
  - избежать преждевременной сложности (roof/slab geometry, cut optimization, nesting);
  - подготовить базу для Sprint 10+ (спецификация и экспорт), не вводя хрупкие полу-решения.

## Коллекции Firestore

| Коллекция | Назначение |
|-----------|------------|
| `sipEditor_projects` | Метаданные, current*, `versionCounter`, `allowedEditorIds`, audit |
| `sipEditor_projectVersions` | `buildingModel`, `basedOnVersionId`, `isSnapshot`, `versionNumber`, … |

## Валидация

Runtime-валидация тел запросов — **Zod** в `apps/api` (не только TypeScript). После успешного parse модель нормализуется через `normalizeBuildingModel`.

## 2D / 3D

- 2D (Sprint 4–7): основной контур редактирования и доменные команды.
- 3D (Sprint 8): инженерный preview для проверки объёмной связности модели (без panelization/spec/export).

## Расширение системы

1. Поля `BuildingModel` — через `@2wix/shared-types` + миграции/`normalizeBuildingModel`.
2. Логика редактирования — `@2wix/editor-core`.
3. Новые HTTP-операции — `apps/api` + клиенты в `sip-editor-web/src/api`.

## API

Подробные payload/response: **`docs/api-contracts.md`**.

## Стек

- React + TypeScript, Zustand, TanStack Query (sip-editor).
- Fastify + Zod + firebase-admin (api), Vitest для критичных unit-тестов.
- pnpm workspaces, ESLint/Prettier на корне.

## Установка зависимостей (pnpm)

На части машин нативный `canvas` падает при `postinstall`. Вариант: `pnpm install --ignore-scripts` для разработки SIP-слоя. См. также корневой `pnpm-workspace`.
