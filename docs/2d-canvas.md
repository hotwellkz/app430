# 2D canvas — стены и проёмы (Sprint 4–5)

## Координаты

- **Мир:** миллиметры, ось Y направлена вниз (как в SVG).
- **Экран:** пиксели относительно элемента `<svg>`.
- **Связь:** `worldToScreen` / `screenToWorld` с параметрами `panX`, `panY`, `zoom` из `useEditorStore`. Группа `<g transform="translate(pan) scale(zoom)">` содержит сетку и стены в мировых единицах.

## Слои

| Файл / компонент | Роль |
|------------------|------|
| `GridLayer.tsx` | minor = `settings.gridStepMm`, major каждые 5000 мм; `vector-effect="non-scaling-stroke"`. |
| `WallsLayer.tsx` | Полигон по центральной линии и `thicknessMm`; стили `external` / `internal` / selected. |
| `WallLengthLabel.tsx` | Подпись длины у выбранной стены. |
| `SelectionHandles.tsx` | Два круга на концах; `data-handle` для hit. |
| `OpeningsLayer.tsx` | Полигоны проёмов на стенах; стили по `openingType`; selected/hover. |
| `EditorCanvas2D.tsx` | События указателя, wheel-zoom, жесты, вызовы команд, fit view. |

## Инструменты

- **select:** клик по стене — выделение; по пустому месту — `clearSelection`; drag ручки — preview локально, на `pointerup` — `updateWall` (+ лёгкий snap к узлам других стен). Клик по проёму — выделение и drag вдоль стены (`updateOpening.positionAlongWall` на `pointerup`).
- **pan:** drag переносит `panX/panY`; средняя кнопка мыши тоже панорамирует в любом режиме.
- **draw-wall:** первый клик — начало (со snap), движение — пунктир, второй клик — конец → `addWall`; **Esc** сбрасывает незавершённый отрезок; режим остаётся `draw-wall` для следующей стены.
- **draw-window / draw-door / draw-portal:** один клик по стене → `addOpening` с пресетами из домена; клик мимо стены — только подсказка (toast).

## Hit-test

- Стена: минимальное расстояние от точки (клик в мм) до отрезка `start`–`end`; порог `hitToleranceWorldMm(zoom)`.
- Ручка: расстояние до `start` или `end` ≤ `endpointHandleRadiusWorldMm(zoom)`.
- Проём: `findClosestOpeningAtPoint` — вдоль оси стены в пределах ширины проёма и половины толщины стены.

## Вид

- **Вписать вид** / первичный авто-fit: `computeWallsBoundingBoxMm` + `computeFitViewTransform` (`viewFit.ts`).

## Тесты

```bash
pnpm --filter sip-editor-web test
```

Файлы: `apps/sip-editor-web/src/canvas2d/*.test.ts`.
