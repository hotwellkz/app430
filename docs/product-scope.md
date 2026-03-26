# SIP Editor — продуктовый scope

## Завершено: foundation (Sprint 1)

- Monorepo (pnpm), `apps/sip-editor-web`, `apps/api`, `packages/*`.
- Типы, доменные фабрики, `editor-core` / `ui-kit` shell.
- Fastify + Firestore `sipEditor_*`, базовые маршруты; CRM entry для редактора — раздел **SIP Проекты** (`/sip-projects`), legacy-страница `/integrations/sip-editor` для отладки.

## Завершено: версии + персистенция + bridge (Sprint 2)

- Расширенные типы `Project` / `ProjectVersion`, audit, `allowedEditorIds`, счётчик версий, `basedOnVersionId`.
- Zod-валидация тел запросов; единый формат ошибок API (`code`, `message`, `details`, `requestId`).
- Optimistic concurrency на **PATCH current-version** (409 + детали).
- Транзакции Firestore для новой версии и сохранения current.
- Временный bridge **`x-sip-user-id`** + query `sipUserId` в редакторе; CRM передаёт UID и создаёт проект с `createdBy`.
- Редактор: черновик `buildingModel`, состояния save/conflict, панель **Versions** (read-only список).
- CRM: привязка `sipEditorProjectId` на сделке, загрузка сделки по `dealId`, открытие существующего SIP-проекта.
- Unit-тесты: concurrency, доступ, схемы Zod.
- Документация: `technical-decisions.md`, `api-contracts.md`.

## Завершено: editor core state + команды (Sprint 3)

- **`@2wix/editor-core`**: единый `useEditorStore` — документ (server/draft, save lifecycle), selection, view, история снимков draft, команды (`EditorCommand`) и чистый reducer (`reduceCommand` / `executeCommand`).
- **Undo/redo** только для изменений модели; вид и выделение в стек не попадают.
- **Домен**: утилиты модели и операции стен/этажей/проёмов в `@2wix/domain-model` (`cloneBuildingModel`, `createWall`, `addWallToModel`, …).
- **UI редактора**: бейдж save / несохранённость, Save / Undo / Redo / Discard, списки этажей/стен для выделения, collapsible debug-панель.
- Тесты Vitest в `packages/editor-core`; описание архитектуры — `docs/editor-core.md`.

## Завершено: 2D walls canvas MVP (Sprint 4)

- SVG-сцена в мм: сетка, стены (полоса по толщине), выделение, ручки концов, preview при рисовании.
- Инструменты **select / pan / draw-wall** в `view.toolMode` (editor-core); zoom/pan/grid/snap из store; wheel-zoom к курсору.
- Жесты: клик по стене → выделение; двухкликовое рисование стены → `addWall`; drag конца → `updateWall`; Delete/Backspace и кнопка → `deleteWall`.
- Левая колонка: этажи + стены активного этажа; правая — инспектор стены (тип, толщина, высота).
- Тесты: `packages/editor-core` (в т.ч. `updateWall` + undo); `apps/sip-editor-web` — хелперы viewport, hit-test, жесты.
- Документация: `docs/2d-canvas.md`, обновлены `editor-core.md`, `technical-decisions.md`.

## Завершено: проёмы + вход в редактор (Sprint 5)

- **Модель проёма** (`Opening`): `floorId`, `openingType` (`window` | `door` | `portal`), `bottomOffsetMm`, геометрия вдоль стены; миграция из legacy `kind` в `normalizeBuildingModel`.
- **Домен**: `openingGeometry`, пресеты `OPENING_DEFAULTS`, валидация границ стены / пересечений / отступов от краёв; каскадное удаление проёмов при удалении этажа.
- **Команды**: `addOpening` / `updateOpening` / `deleteOpening` в истории и save/discard; сброс выделения при удалении проёма.
- **Canvas**: слой проёмов, hit-test, инструменты **draw-window / draw-door / draw-portal** (один клик по стене), перетаскивание вдоль стены, **Вписать вид** + авто-fit при первой загрузке этажа.
- **UI**: список проёмов в сайдбаре, инспектор проёма, тулбар, лёгкий snap узлов стен при отпускании ручки.
- **Вход**: CRM **`/sip-projects`** (список, тестовый/последний проект, авто-`sipUserId`); карточка сделки — блок SIP; в приложении редактора — **`/sip-editor/dev-launch`**, guard-экраны со ссылками в CRM (и dev-hint только в dev).
- Тесты: `packages/domain-model` (openingOps), `editor-core`, `sip-editor-web` (hit-test, view fit).
- Документация: `docs/openings.md`, `docs/dev-launch.md`, обновлены `editor-core.md`, `technical-decisions.md`, `2d-canvas.md`.

## Завершено: этажи и многоэтажный workflow (Sprint 6)

- **Модель `Floor` v2**: `level`, `heightMm`, `floorType` (`full` | `mansard` | `basement`), миграция в `normalizeBuildingModel`, `BUILDING_MODEL_SCHEMA_VERSION = 2`.
- **Домен**: `validateFloorShape`, `tryDeleteFloorFromModel`, `updateFloorInModel`, `duplicateFloorInModel`, `getFloorsSorted`, `suggestNextFloor`, шаблоны 1/2 этажа для пустой модели.
- **Команды**: `addFloor`, `updateFloor`, `duplicateFloor`, `deleteFloor`, `setActiveFloor` (вид без истории); `clampActiveFloorToModel` после undo/redo/save.
- **UI**: список этажей с дублированием и безопасным удалением (`confirm`), инспектор этажа, сводка объекта, шаблоны на пустой модели, empty-state на canvas для пустого этажа.
- Тесты: `domain-model/floorOps.test.ts`, расширен `editorCore.test.ts`, RTL `EditorSidebarFloors.test.tsx`.
- Документация: `docs/floors.md`, обновлены `editor-core.md`, `technical-decisions.md`.

## Завершено: vertical coherence + slabs/roof MVP (Sprint 7)

- **Vertical coherence**: effective height стены = `wall.heightMm` (override) или `floor.heightMm` (inherit), мягкие warning-и при несогласованных отметках этажей.
- **Slab MVP**: параметрическая сущность перекрытия (`slabType`, `direction`, `contourWallIds`, `thicknessMm`, `generationMode`), базовый режим **одно перекрытие на этаж**.
- **Roof MVP**: параметрическая сущность крыши (`roofType`, `slopeDegrees`, `ridgeDirection`, `overhangMm`, `baseElevationMm`), базовый режим **одна основная крыша на проект** (верхний этаж).
- **Команды editor-core**: `add/update/delete` для slab и roof с полноценным dirty/save/undo/redo/discard.
- **UI**: quick actions в левом меню (создать перекрытие/крышу), инспекторы slab/roof, warnings panel, расширенный summary, 2D overlays для направления перекрытия и параметров крыши.
- Тесты: доменные (`vertical/roof/slab`), editor-core команды, web-компоненты sidebar/warnings.
- Документация: `docs/vertical-model.md`, `docs/roof-and-slabs.md`, обновлены `editor-core.md`, `technical-decisions.md`.

## Завершено: 3D preview MVP (Sprint 8)

- В `sip-editor-web` добавлен режим **2D / 3D** в editor shell без изменения текущего save/discard/undo flow.
- Реализован отдельный adapter-слой `preview3d`: `buildPreviewSceneModel(buildingModel, options)` преобразует `draftModel` в устойчивый snapshot для рендера.
- Стены строятся как объёмные сегменты с учётом проёмов через **сегментацию**, а не fragile boolean CSG.
- Добавлены 3D-слои: walls, openings, slabs, roof; фильтр этажей: `all floors` / `active floor only`.
- Viewer поддерживает orbit-камеру (rotate/pan/zoom), fit/reset, empty-state и debug-инфо по построенной сцене.
- Подсветка выделения из editor-core синхронизирована в 3D для wall/opening/slab/roof; базовый click-select в 3D отправляет `selectObject`.
- Тесты: adapter + sync с draft/discard/floor filter + UI smoke для 3D-панели.
- Документация: `docs/3d-preview.md`, обновлены `product-scope.md`, `editor-core.md`, `technical-decisions.md`.

## Завершено: stabilization sprint (API/runtime/entry hardening)

- Укреплён entry-flow CRM -> SIP Editor: единые env/helpers для URL и API-базы.
- Добавлены fail-fast проверки env в CRM и в `sip-editor-web`.
- API health усилен: `/health` и `/health/details` с проверкой Firestore/collections и requestId.
- Расширены runtime guards и user-facing состояния загрузки проекта/версии (включая 503/504).
- Добавлены error boundaries в editor shell и отдельный fail-safe для 3D preview.
- Улучшена устойчивость user context в editor (query/session/localStorage fallback).
- Добавлены тесты на env/context hardening.

## Завершено: panelization MVP (Sprint 9, walls-first)

- Добавлен отдельный слой расчёта `@2wix/panel-engine` с `buildPanelizationSnapshot(buildingModel)`.
- В MVP панелизируются только стены: наружные по умолчанию, внутренние — только `bearing` + `panelizationEnabled=true`.
- Реализованы wall-настройки SIP: `structuralRole`, `panelizationEnabled`, `panelDirection`.
- Добавлены глобальные settings панелизации: `defaultPanelTypeId`, `allowTrimmedPanels`, `minTrimWidthMm`, `preferFullPanels`, label-префиксы.
- Учтены проёмы (left/right/above/below зоны), добавлены структурированные warning/error коды.
- В `sip-editor-web` добавлены:
  - панель `SIP / Панелизация` со статистикой, настройками и warnings;
  - 2D overlay панелей для active floor с labels и toggle;
  - блок SIP в `WallInspector` (eligibility/panels/warnings/editable fields).
- Generated panels остаются derived state и не становятся source of truth в Firestore.

## Завершено: spec / BOM MVP (Sprint 10, wall panels first)

- Добавлен отдельный `@2wix/spec-engine` для агрегации спецификации поверх `panelization snapshot`.
- Реализована агрегированная BOM-выдача по SIP wall panels:
  - группировка по типам панелей;
  - summary totals (panels/trimmed/area/walls/warnings);
  - wall-level breakdown.
- Добавлен wall-level `panelTypeId` override с fallback на global `defaultPanelTypeId`.
- В `sip-editor-web` добавлена панель `Спецификация / BOM`:
  - summary block;
  - aggregated table;
  - wall breakdown с быстрым выбором стены.
- Добавлен экспорт derived спецификации:
  - CSV;
  - XLSX (Summary/BOM/Walls).
- Spec остаётся derived state: source of truth по-прежнему `BuildingModel`.

## Завершено: export package MVP (Sprint 11)

- Добавлен отдельный `@2wix/export-engine` как единый pipeline выгрузки.
- Добавлены форматы выгрузки:
  - PDF report;
  - CSV;
  - XLSX.
- В `sip-editor-web` добавлена панель `Экспорт / Выгрузки`:
  - кнопки формирования PDF/CSV/XLSX;
  - список последних выгрузок со статусом и traceability по версии.
- API расширен endpoints:
  - `POST /api/projects/:projectId/exports`;
  - `GET /api/projects/:projectId/exports`;
  - `GET /api/projects/:projectId/exports/:exportId`.
- Экспорт привязан к текущей сохраненной версии проекта (не к несохраненному draft).

## Завершено: export storage + async-like workflow (Sprint 12)

- Реализовано сохранение export binaries в object storage (Firebase Storage через backend).
- Export artifact lifecycle: `pending -> ready|failed` с `retryCount`, `completedAt`, `errorMessage`.
- Добавлен повторный download прошлых `ready` экспортов (через signed URL / download endpoint).
- Добавлен retry flow для `failed` экспортов.
- В UI добавлен выбор при dirty draft:
  - сохранить и экспортировать;
  - экспортировать текущую сохранённую версию.
- Сохранена backward compatibility для legacy export rows без `storagePath/fileUrl`.

## Завершено: roof/slab panelization MVP (Sprint 13)

- `panel-engine` расширен от wall-only до `wall + slab + roof`.
- Добавлены slab/roof summaries, totals by sourceType, новые warning codes и стабильные labels:
  - `W-*`, `S-*`, `R-*`.
- Реализована упрощенная панелизация:
  - slabs по contour/bounding geometry;
  - roof для `single_slope` и `gable` на параметрической модели.
- UI расширен:
  - SIP panelization panel показывает секции Walls/Slabs/Roof;
  - Slab/Roof inspectors показывают panelization diagnostics;
  - 2D overlay умеет показывать панели стен/перекрытий/крыши с фильтрами.
- Подготовлена база для следующего расширения spec/BOM по sourceType.

## Завершено: expanded BOM / source-type-aware spec (Sprint 14)

- `spec-engine` расширен от wall-only к `wall + slab + roof` aggregation.
- Добавлены:
  - totals by sourceType;
  - object-level breakdown для wall/slab/roof;
  - warnings passthrough в spec context.
- UI `SpecPanel` получил:
  - summary с W/S/R breakdown;
  - sourceType filter (`all/wall/slab/roof`);
  - отдельные секции Walls/Slabs/Roof.
- Инспекторы (wall/slab/roof) теперь показывают spec counters и быстрый переход в спецификацию.
- `export-engine` подготовлен к расширенному spec snapshot без поломки текущего export workflow.

## Завершено: commercial layer MVP + export presentation upgrade (Sprint 15)

- Добавлен отдельный `@2wix/commercial-engine` для derived `CommercialSnapshot` поверх expanded spec.
- Введены presentation modes:
  - `technical`
  - `commercial`
- Экспортные контракты/API/UI расширены `presentationMode` с backward-compatible default (`technical`).
- Улучшены PDF/CSV/XLSX layouts:
  - technical: подробный инженерный формат;
  - commercial: укрупненные business-friendly sections/items + warnings summary.
- `SpecPanel` улучшен по UX: фильтрация, сортировка, grouping mode, более читаемый warnings/object breakdown.
- Подготовлены future hooks для pricing (`costKey`) без реализации реального pricing runtime.

## Завершено: AI import foundation (Sprint 16, этап 1)

- Добавлен backend/domain foundation для import-job без OCR/vision/LLM extraction.
- Введена canonical intermediate schema `ArchitecturalImportSnapshot` и стабильные shared API contracts.
- Реализованы endpoints:
  - `POST /api/projects/:projectId/import-jobs`
  - `GET /api/projects/:projectId/import-jobs`
  - `GET /api/projects/:projectId/import-jobs/:jobId`
- Добавлена persistence коллекция `sipEditor_importJobs` для source image refs + snapshot.
- Добавлен честный mock snapshot factory (без выдуманной геометрии, с явными unresolved/notes).
- Подготовлена база для следующего этапа: wizard/review/apply и подключение extractor.

## Завершено: AI import lifecycle orchestration foundation (Sprint 16, этап 2)

- `import-job` переведён на pipeline lifecycle:
  - `queued -> running -> needs_review | failed`.
- `POST /api/projects/:projectId/import-jobs` теперь запускает backend orchestration и возвращает итоговое состояние job.
- Добавлен extractor adapter слой (mock implementation + resolver) для будущей интеграции real extractor без ломки API.
- Централизованы status transitions и инварианты хранения snapshot/errorMessage.

## Завершено: AI import async-friendly execution mode (Sprint 16, этап 3)

- Добавлен runner/scheduler abstraction для запуска import pipeline.
- Поддержаны execution modes:
  - `sync` (финальный статус в ответе POST),
  - `async-inline` (ранний статус + последующее обновление через GET).
- Режим выбирается централизованно через `IMPORT_JOB_EXECUTION_MODE`.
- Архитектура подготовлена к замене `async-inline` на реальный worker mode в следующих этапах.

## Не входит сейчас

- Размерные линии «как в CAD», ручки resize проёмов на canvas (только инспектор и drag вдоль стены).
- SIP-панели, BOM/spec/export, CAD-grade булевы операции, freeform 3D-моделирование.
- Полноценная RBAC/проверка Firebase token на API (см. bridge в technical-decisions).

## Следующие этапы

| Этап | Фокус |
|------|--------|
| Sprint 9+ | Панелизация, спецификация, экспорт и расчётные модули |
| Hardening | JWT/Firebase Admin verify, company-scoped projects, Firestore security rules под SIP |
