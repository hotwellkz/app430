# Roof / Slab Panelization (Sprint 13)

## Geometry assumptions

- Slab layout строится по `contourWallIds` через bounding box доступных стен.
- Roof layout строится от footprint верхнего этажа + `overhangMm`.
- Это инженерный MVP, не CAD-grade геометрия.

## Supported roof types

- `single_slope`
- `gable`

Другие типы/сложные конфигурации на текущем этапе не поддерживаются и дают warnings.

## Slab rules

- Источник направления: `slab.direction` (`x` / `y`).
- Effective panel type: `slab.panelTypeId` -> global `defaultPanelTypeId`.
- Trim policy: общая (`allowTrimmedPanels`, `minTrimWidthMm`).
- Нет валидной раскладки -> warning/error, без падения движка.

## Roof rules

- Источник типа: `roof.roofType`.
- Уклон валидируется (`ROOF_SLOPE_INVALID`).
- Effective panel type: `roof.panelTypeId` -> global `defaultPanelTypeId`.
- Раскладка по slope-sections (1 для `single_slope`, 2 для `gable`).

## Warnings

- Slab: `SLAB_NOT_PANELIZABLE`, `SLAB_TOO_SMALL`, `SLAB_DIRECTION_MISSING`, `NO_VALID_SLAB_LAYOUT`.
- Roof: `ROOF_NOT_PANELIZABLE`, `ROOF_TYPE_NOT_SUPPORTED`, `ROOF_SLOPE_INVALID`, `NO_VALID_ROOF_LAYOUT`, `ROOF_GEOMETRY_INCOMPLETE`.

## Current limitations

- Нет nesting/cut optimization, CNC maps, ERP/pricing.
- Нет multi-body roof CAD и freeform roof editing.
- Spec/BOM остаётся wall-first; slab/roof добавлены как база для следующего спринта.
