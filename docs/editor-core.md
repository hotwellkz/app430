# Editor core (`@2wix/editor-core`)

Краткий ориентир для разработчиков: как устроено ядро редактора после Sprint 3.

## Store

- **`useEditorStore`** (Zustand) объединяет:
  - **`document`** — `EditorDocumentState` (`serverModel`, `draftModel`, версия, `saveStatus`, `hasUnsavedChanges`, …);
  - **`selection`** — выбранный/hovered объект и заготовка `multiSelectIds`;
  - **`view`** — активная панель, этаж, **`toolMode`** (`select` | `pan` | `draw-wall` | `draw-window` | `draw-door` | `draw-portal`), zoom/pan, сетка, snap;
  - **`history`** — `past` / `future` как массивы снимков **`BuildingModel`**, плюс `limit`.

## Поток команд

1. UI вызывает **`applyCommand(cmd)`** или обёртку (`setZoom`, `selectObject`, …).
2. Store вызывает **`reduceCommand(prevState, cmd)`**.
3. Если команда меняет модель и не является «полной заменой» черновика, store **добавляет текущий draft в `past`** (с обрезкой по лимиту) и очищает **`future`**.
4. Если команда **`setDraftModel` / `replaceDraftModel` / `resetDraftToServer`**, стеки истории **сбрасываются** в reducer + store.

Чистая функция **`executeCommand(cmd, state)`** — то же, что `reduceCommand(state, cmd)` с переставленными аргументами (удобно для тестов и внешнего API).

## Поток сохранения (интеграция с API)

Редактор **не** ходит в HTTP из `editor-core`. В `sip-editor-web`:

1. **`beginSave()`** → `saveStatus: "saving"`.
2. Успех PATCH → **`applySaveSuccess(version)`** — синхронизация meta через `syncBuildingModelMeta`, `serverModel`/`draftModel` совпадают, `hasUnsavedChanges: false`, история очищена.
3. **409** → **`markSaveConflict()`** (черновик не теряется).
4. Прочие ошибки → **`markSaveError(message)`**.

Опционально: **`saveDraft(performSave)`** в store оборачивает try/catch вокруг переданного `Promise`.

## Загрузка версии

**`loadDocumentFromServer({ projectId, projectTitle, version })`** клонирует `version.buildingModel`, прогоняет через `syncBuildingModelMeta`, выставляет server/draft одинаково, сбрасывает историю и selection, выставляет **`activeFloorId`** на первый этаж по **`getFloorsSorted(draft)[0]`** (порядок UI, не сырой порядок массива).

### Активный этаж и этажные команды (Sprint 6)

- **`view.activeFloorId`** — только **view state**: команда **`setActiveFloor`** не пишет в `past` и не помечает черновик грязным.
- Мутации **`addFloor` / `updateFloor` / `duplicateFloor` / `deleteFloor`** идут через **`reduceCommand`**, попадают в dirty и undo/redo.
- **`deleteFloor`**: домен **`tryDeleteFloorFromModel`** запрещает удаление последнего этажа; при удалении активного этажа `activeFloorId` переключается на первый из **`getFloorsSorted`** оставшейся модели.
- **`duplicateFloor`**: после успеха активный этаж и выделение переключаются на новый этаж.
- **`clampActiveFloorToModel`**: после **undo**, **redo** и **applySaveSuccess**, если текущий `activeFloorId` отсутствует в модели, выставляется валидный этаж (иначе после отката оставался бы «битый» id).

Подробнее: **`docs/floors.md`**.

### Slab / Roof команды (Sprint 7)

- Добавлены команды модели: **`addSlab` / `updateSlab` / `deleteSlab`** и **`addRoof` / `updateRoof` / `deleteRoof`**.
- Эти команды являются **model-mutation**: попадают в dirty-state, пишутся в undo-history и участвуют в discard/save так же, как стены/проёмы/этажи.
- `selection` очищается при удалении выбранного slab/roof.
- Проверки валидности выполняются в domain-layer (`validateSlab`, `validateRoof`), reducer возвращает понятную ошибку и не портит draft.

### 3D preview и draftModel (Sprint 8)

- 3D-режим в `sip-editor-web` строится **только из `document.draftModel`**.
- Сам `editor-core` не содержит three.js-логики и не знает про рендерер: граница остаётся прежней — команды/состояние в ядре, визуализация в приложении.
- В `sip-editor-web/src/preview3d` добавлен adapter `buildPreviewSceneModel`:
  - вход: `BuildingModel` + view options (layers, floor mode, activeFloorId);
  - выход: snapshot примитивов (box meshes) + stats/warnings/bounds для viewer.
- Это даёт корректную синхронизацию:
  - `applyCommand` в 2D -> меняется `draftModel` -> пересчёт preview snapshot;
  - `discardDraft` -> snapshot возвращается к server-состоянию;
  - `applySaveSuccess` не ломает 3D, так как draft/server снова синхронны.
- Floor filtering (`all`/`active-only`) выполняется в adapter-слое по `activeFloorId`, без мутации доменной модели.

### Panelization snapshot и draftModel (Sprint 9)

- Панелизация рассчитывается в отдельном пакете `@2wix/panel-engine` как **derived state**:
  - вход: `document.draftModel`;
  - выход: `PanelizationResult` (`generatedPanels`, `warnings`, `stats`, `wallSummaries`).
- `editor-core` не хранит generated panels в persisted state и не включает их в undo-history как source of truth.
- В `editor-core` добавлена только модельная команда `updatePanelSettings` для правки глобальных SIP-настроек в `draftModel.panelSettings`.
- Любая команда, меняющая `draftModel` (стены, проёмы, этажи, wall SIP fields, panel settings), автоматически даёт новый snapshot при следующем пересчёте в UI-слое (`useMemo`).

### Effective высота стен

- Для стены введена логика **effective height**:
  - если `wall.heightMm` задана — это override;
  - иначе используется `floor.heightMm`.
- Режим высоты (`inherited` / `overridden`) и effective-значение показываются в `WallInspector`.
- Это влияет на вертикальную согласованность модели и подготовку к 3D, но пока не блокирует сохранение.

При явном **перезагрузке с сервера после конфликта** в UI дополнительно увеличивается локальный счётчик синхронизации, чтобы подтянуть новое тело той же версии, если id/номер схемы не изменились.

## Тесты

```bash
pnpm --filter @2wix/editor-core test
```

См. `packages/editor-core/src/editorCore.test.ts`.

## Связь с 2D-сценой (Sprint 4–5)

- Компонент **`EditorCanvas2D`** в `sip-editor-web` подписан на **`draftModel`**, **`view`** (включая `activeFloorId`, `zoom`, `pan`, `gridVisible`, `snapEnabled`, `toolMode`) и **`selection`**.
- **Мутации модели** на canvas: стены — **`addWall`**, **`updateWall`**, **`deleteWall`**; проёмы — **`addOpening`**, **`updateOpening`**, **`deleteOpening`**; этажи — см. **`docs/floors.md`**. Выделение — **`selectObject`** / **`clearSelection`**. Ошибки валидации домена показываются кратким toast в UI, черновик не ломается.
- **Инструменты** переключаются через **`setToolMode`** → команда `setToolMode`; это **не** попадает в undo/redo.
- Подробности viewport, hit-test и проёмов: **`docs/2d-canvas.md`**, **`docs/openings.md`**.
