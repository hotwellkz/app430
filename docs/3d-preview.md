# 3D Preview MVP (Sprint 8)

## Цель

Дать устойчивый инженерный 3D-preview текущего `draftModel` без panelization/spec/export и без сложного CAD.

## Стек

- `three` + `@react-three/fiber`
- `@react-three/drei` (Orbit controls, camera helpers)

Причина выбора: минимальная сложность интеграции в React shell и реактивная синхронизация с текущим состоянием editor-core.

## Архитектура сцены

1. `editor-core` хранит `document.draftModel` (single source of truth).
2. Adapter `buildPreviewSceneModel(model, options)` в `apps/sip-editor-web/src/preview3d`.
3. Viewer (`Preview3DPanel`) рендерит snapshot из adapter без доменных вычислений внутри рендера.

## Adapter layer

Вход:
- `BuildingModel`
- options: `activeFloorId`, `floorMode` (`all`/`active-only`), layer visibility

Выход:
- массивы мешей для `walls/openings/slabs/roof`
- `bounds` для fit camera
- `stats` и `warnings` для debug panel

## Стены и проемы

Используется сегментация, не CSG:

1. Для стены считаем ось (`start -> end`) и длину.
2. Проемы переводим в интервалы вдоль оси + вертикальные интервалы (`bottom..top`).
3. Стену делим по X-интервалам проемов.
4. На каждом сегменте режем вертикально по объединенным hole-диапазонам.
5. Оставшиеся куски строим как box meshes.

Плюс:
- устойчиво при нескольких проемах;
- предсказуемо и проще тестировать;
- нет тяжелых булевых операций.

## Slabs и roof

- Slab: простой box на уровне этажа (`ground`) или на уровне верха этажа (`interfloor/attic`) с `thicknessMm`.
- Roof:
  - `single_slope`: один box-клин в упрощенной форме;
  - `gable`: два box-сегмента;
  - учитываются `slopeDegrees`, `ridgeDirection`, `overhangMm`, `baseElevationMm`.

## Floor visibility и слои

- Layer toggles: `Walls`, `Openings`, `Slabs`, `Roof`
- Floor mode: `all floors` / `active floor only`

Фильтрация делается в adapter-слое, не через мутацию модели.

## Синхронизация с 2D

- Любая команда 2D меняет `draftModel`.
- `Preview3DPanel` пересчитывает snapshot по memo и показывает актуальную 3D геометрию.
- `discard` возвращает сцену к серверному состоянию через reset draft.
- `save` не ломает preview, так как store продолжает отдавать валидный draft.
