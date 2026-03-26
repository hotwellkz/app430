# Проёмы (2D MVP)

## Модель

Сущность **`Opening`** (`@2wix/shared-types`):

| Поле | Смысл |
|------|--------|
| `id` | Стабильный id |
| `floorId` | Этаж (должен совпадать с `wall.floorId`) |
| `wallId` | Ровно одна несущая стена |
| `positionAlongWall` | Центр проёма вдоль оси стены, мм от точки `start` |
| `widthMm` | Ширина вдоль стены |
| `heightMm` | Высота (для спецификации / инспектора; 2D-срез условный) |
| `bottomOffsetMm` | Низ проёма над «полом» среза; у **двери** в MVP ≈ **0** |
| `openingType` | `window` \| `door` \| `portal` |
| `label?` | Опционально |

Дефолтные размеры при создании: **`OPENING_DEFAULTS`** в `@2wix/domain-model` (`openingPresets.ts`), не в JSX.

## Валидация (домен)

Реализовано в **`validateOpeningPlacement`** / `openingOps.ts` и хелперах **`openingGeometry.ts`**:

- стена существует, `floorId` совпадает со стеной;
- центр и полуширина укладываются в длину стены с **отступом от краёв** (`OPENING_EDGE_MARGIN_MM`);
- нет пересечений и «нулевого зазора» с другими проёмами на той же стене (`OPENING_MIN_GAP_ALONG_MM`);
- разумные пределы высоты и `bottomOffset`;
- дверь: `bottomOffsetMm` не больше допуска `DOOR_BOTTOM_OFFSET_EPS_MM`.

Отдельные флаги: `detectOpeningOutOfWallBounds`, `detectOpeningOverlap` (см. экспорты пакета).

## Canvas

- Рендер только проёмов **`getOpeningsByFloor(draft, activeFloorId)`**.
- Полигон: **`computeOpeningFootprintCorners`** — прямоугольник вдоль стены × поперёк толщины (визуальный «вырез»).
- Hit-test: **`findClosestOpeningAtPoint`** (`openingHitTest.ts`) — проекция на ось стены + допуск по толщине.
- **Создание:** режимы `draw-window` / `draw-door` / `draw-portal` → **`buildOpeningOnWallClick`** → команда **`addOpening`**.
- **Перемещение:** в режиме select, drag по проёму → локальный preview, на `pointerup` → **`updateOpening`** с новым `positionAlongWall`; сглаживание: **`proposeOpeningDragAlongWall`** (сетка + лёгкий snap к безопасным краям).

## Команды (`editor-core`)

- **`addOpening`**, **`updateOpening`**, **`deleteOpening`** — обычные мутации модели: dirty, история, сохранение через тот же PATCH current-version.
- При **`deleteOpening`** выделение сбрасывается, если удалён текущий проём (`reduceCommand`).

## Тесты

```bash
pnpm --filter @2wix/domain-model test
pnpm --filter sip-editor-web test
```
