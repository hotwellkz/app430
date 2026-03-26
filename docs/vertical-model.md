# Vertical Model (Sprint 7)

## Effective высота стен

- `wall.heightMm` отсутствует → стена использует `floor.heightMm` (режим `inherited`).
- `wall.heightMm` задана → это override (режим `overridden`).
- Хелперы:
  - `getEffectiveWallHeight(wall, floor)`
  - `getWallHeightMode(wall)`
  - `getWallEffectiveHeightFromModel(model, wall)`

`WallInspector` показывает explicit/effective высоты и текущий режим.

## Мягкие предупреждения

Хелпер `collectVerticalWarnings(model)` формирует non-blocking предупреждения:

- `FLOOR_ELEVATION_MISMATCH` — если `nextFloor.elevationMm` не совпадает с `prev.elevationMm + prev.heightMm`.
- `MISSING_INTERFLOOR_SLAB` — если у предыдущего этажа отсутствует базовое перекрытие.
- `MISSING_ROOF` — если крыша не создана.

Это **не блокирует сохранение**, только помогает обнаружить несогласованность модели до 3D.

## Building summary

Сводка показывает:

- количество этажей;
- активный этаж, его отметку и высоту;
- наличие крыши;
- число перекрытий (на активном этаже / всего);
- статус сохранения и текущую версию.
