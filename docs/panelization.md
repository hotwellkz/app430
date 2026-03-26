# SIP Panelization MVP (Sprint 13)

## Scope

- Walls + slabs + roof panelization (MVP).
- External walls are included by default.
- Internal walls are included only when `structuralRole="bearing"` and `panelizationEnabled=true`.
- Roof/slab panelization без nesting/CNC и без CAD-grade оптимизаций.

## Engine boundary

- Implementation lives in `packages/panel-engine`.
- Public API: `buildPanelizationSnapshot(buildingModel, options?)`.
- Output is `PanelizationResult`:
  - `generatedPanels`
  - `warnings`
  - `stats`
  - `wallSummaries`
  - `slabSummaries`
  - `roofSummaries`

`generatedPanels` are **derived state** from `draftModel`, not persisted source-of-truth.

## Supported objects

- `Wall` (with `wallType`, `structuralRole`, `panelizationEnabled`, `panelDirection`, `heightMm`)
- `Opening` (`window`/`door`/`portal`)
- `Slab` (`direction`, `contourWallIds`, `panelizationEnabled`, `panelTypeId?`)
- `Roof` (`single_slope`/`gable`, `slopeDegrees`, `ridgeDirection`, `overhangMm`, `panelizationEnabled`, `panelTypeId?`)
- `Floor` (`level`, `heightMm`)
- global `panelLibrary` and `panelSettings`

## Algorithm overview

For each eligible wall:

1. Build wall rectangle (`length x effectiveHeight`).
2. Collect wall openings sorted by `positionAlongWall`.
3. Build rectangular zones around openings:
   - side/main zones from wall span subtraction;
   - `above_opening` always;
   - `below_opening` for windows only.
4. Split each zone by panel direction:
   - `vertical`: split along wall axis by panel width;
   - `horizontal`: rows by height.
5. Apply trim policy:
   - trim allowed only when `allowTrimmedPanels=true` and trim `>= minTrimWidthMm`;
   - otherwise emit warnings/errors.

## Labeling

Stable format:

- `W-{floorLevel}-{wallIndex}-{panelIndex}`
- `S-{floorLevel}-{slabIndex}-{panelIndex}`
- `R-{floorLevel}-{roofSectionIndex}-{panelIndex}`

Numbering is deterministic within each wall and reusable for future spec/export.

## Warning/error codes

- `PANEL_TYPE_NOT_SET`
- `PANEL_DIRECTION_MISSING`
- `TRIM_TOO_SMALL`
- `OPENING_TOO_CLOSE_TO_WALL_START`
- `OPENING_TOO_CLOSE_TO_WALL_END`
- `PANELIZATION_DISABLED`
- `WALL_TOO_SHORT_FOR_LAYOUT`
- `NO_VALID_LAYOUT`
- `INTERNAL_WALL_SKIPPED`
- `SLAB_NOT_PANELIZABLE`
- `SLAB_TOO_SMALL`
- `SLAB_DIRECTION_MISSING`
- `NO_VALID_SLAB_LAYOUT`
- `ROOF_NOT_PANELIZABLE`
- `ROOF_TYPE_NOT_SUPPORTED`
- `ROOF_SLOPE_INVALID`
- `NO_VALID_ROOF_LAYOUT`
- `ROOF_GEOMETRY_INCOMPLETE`

## UI integration

- Right panel: summary по `Walls/Slabs/Roof` + settings + warnings.
- Wall/Slab/Roof inspectors: panelization status, effective panel type, panel/trim/warning counters.
- 2D canvas: panel overlay на активном этаже с фильтрами W/S/R.

## Current limitations

- Roof поддерживает только `single_slope` и `gable`.
- Slab/roof geometry пока основаны на bounding/parametric assumptions.
- Spec/BOM по-прежнему wall-first (slab/roof подготовлены как source-aware base).
- No cut optimization / nesting / CNC maps.
