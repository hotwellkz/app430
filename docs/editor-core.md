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

**`loadDocumentFromServer({ projectId, projectTitle, version })`** клонирует `version.buildingModel`, прогоняет через `syncBuildingModelMeta`, выставляет server/draft одинаково, сбрасывает историю и selection, выставляет `activeFloorId` на первый этаж при наличии.

При явном **перезагрузке с сервера после конфликта** в UI дополнительно увеличивается локальный счётчик синхронизации, чтобы подтянуть новое тело той же версии, если id/номер схемы не изменились.

## Тесты

```bash
pnpm --filter @2wix/editor-core test
```

См. `packages/editor-core/src/editorCore.test.ts`.

## Связь с 2D-сценой (Sprint 4–5)

- Компонент **`EditorCanvas2D`** в `sip-editor-web` подписан на **`draftModel`**, **`view`** (включая `activeFloorId`, `zoom`, `pan`, `gridVisible`, `snapEnabled`, `toolMode`) и **`selection`**.
- **Мутации модели** на canvas: стены — **`addWall`**, **`updateWall`**, **`deleteWall`**; проёмы — **`addOpening`**, **`updateOpening`**, **`deleteOpening`**. Выделение — **`selectObject`** / **`clearSelection`**. Ошибки валидации домена показываются кратким toast в UI, черновик не ломается.
- **Инструменты** переключаются через **`setToolMode`** → команда `setToolMode`; это **не** попадает в undo/redo.
- Подробности viewport, hit-test и проёмов: **`docs/2d-canvas.md`**, **`docs/openings.md`**.
