# SIP Panelization v1 (Sprint 9)

## Scope

- Walls-first panelization only.
- External walls are included by default.
- Internal walls are included only when `structuralRole="bearing"` and `panelizationEnabled=true`.
- Roof/slab panelization is intentionally out of scope for v1.

## Engine boundary

- Implementation lives in `packages/panel-engine`.
- Public API: `buildPanelizationSnapshot(buildingModel, options?)`.
- Output is `PanelizationResult`:
  - `generatedPanels`
  - `warnings`
  - `stats`
  - `wallSummaries`

`generatedPanels` are **derived state** from `draftModel`, not persisted source-of-truth.

## Supported objects (v1)

- `Wall` (with `wallType`, `structuralRole`, `panelizationEnabled`, `panelDirection`, `heightMm`)
- `Opening` (`window`/`door`/`portal`)
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

Stable format v1:

- `W-{floorLevel}-{wallIndex}-{panelIndex}`

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
- `ROOF_NOT_SUPPORTED_YET`
- `SLAB_NOT_SUPPORTED_YET`

## UI integration (v1)

- Right panel: `SIP / Панелизация` summary + settings + warnings.
- Wall inspector: SIP block with eligibility, direction, enable/disable, panel count, warning summary.
- 2D canvas: panel overlay on active floor with boundaries/labels and visibility toggle.

## Current limitations

- No roof panelization.
- No slab panelization.
- No BOM/spec/export.
- No cut optimization / nesting / CNC maps.
