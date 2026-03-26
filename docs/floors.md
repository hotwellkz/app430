# Этажи (Floors) — Sprint 6

## Модель данных (`Floor`)

Поле `label` — отображаемое имя («1 этаж», «Мансарда»).

| Поле | Смысл |
|------|--------|
| `id` | Стабильный id |
| `label` | Название |
| `level` | Порядковый уровень (целое ≥ 1), для UX и отчётов |
| `elevationMm` | Отметка низа этажа, мм |
| `heightMm` | Высота этажа до перекрытия, мм (**> 0**) |
| `floorType` | `full` \| `mansard` \| `basement` |
| `sortIndex` | Порядок в списках UI |

Тип **`basement`** оставлен для цоколя/подвала с отрицательной или низкой отметкой; **`full`** и **`mansard`** покрывают типовой 1–2 этажный жилой дом.

Схема **`BUILDING_MODEL_SCHEMA_VERSION = 2`**: старые JSON без `level` / `heightMm` / `floorType` нормализуются в `normalizeBuildingModel` (дефолты: `level = index+1`, `heightMm = 2800`, `floorType = full`).

## Валидация

- `validateFloorShape` — полная проверка этажа (имя непустое, уровень целый ≥ 1, высота > 0, тип из enum).
- `addFloor` в reducer: отклоняет невалидный этаж до записи в модель.
- **Строгая связка «отметка следующего = отметка + высота предыдущего»** в MVP **не** проверяется автоматически (слишком много исключений: подвал, врезка мансарды); дублирование этажа подставляет предложенные `level` / `elevationMm` по правилу «над предыдущим».

## Операции (domain-model)

- `createFloor`, `addFloorToModel`, `tryDeleteFloorFromModel`, `deleteFloorFromModel` (внутреннее удаление без проверки «последний»).
- `updateFloorInModel` — patch полей + валидация.
- `duplicateFloorInModel` — новый этаж, новые id у стен и проёмов, `wallId` в проёмах пересобран.
- `getFloorsSorted` — сортировка по `sortIndex`, затем `level`, затем `elevationMm`.
- `suggestNextFloor` — поля для следующего этажа (имя, уровень, отметка = предыдущая + высота).
- `applySingleFloorTemplate` / `applyTwoStoryFloorTemplate` — только если `floors.length === 0`.

## Команды editor-core

| Команда | Модель | История undo |
|---------|--------|--------------|
| `addFloor` | да | да |
| `updateFloor` | да | да |
| `duplicateFloor` | да | да |
| `deleteFloor` | да | да |
| `setActiveFloor` | нет | нет |

`setActiveFloor` отклоняется, если id не существует в черновике (кроме `null`).

После **undo/redo** и **applySaveSuccess** вызывается **`clampActiveFloorToModel`**: если `activeFloorId` не найден в модели, активным становится первый этаж по `getFloorsSorted`.

## UI

- Левая колонка: список этажей (сортировка как в `getFloorsSorted`), активный подсвечен, **Дублировать**, меню **Ещё…** (свойства / удалить с `confirm`).
- Правая панель: **BuildingSummaryPanel** (сводка), **FloorInspector** когда не выбраны стена/проём (редактирование полей этажа).
- Пустая модель: кнопки шаблонов «1 этаж» / «2 этажа» (только набор этажей, без стен).
- Canvas: только объекты `activeFloorId`; пустой этаж — подсказка поверх сцены.

## Дублирование этажа

Одна доменная операция `duplicateFloorInModel`: гарантирует согласованность графа стен/проёмов и новые id. Редактор после команды переключает активный этаж на копию и выделяет этаж.
