# Specification / BOM v1 (Sprint 10)

## Scope v1

- Source: wall panelization snapshot (`generatedPanels`) only.
- Includes:
  - aggregated BOM by panel type;
  - summary totals;
  - wall-level breakdown.
- Excludes:
  - roof/slab panelization;
  - advanced material estimation;
  - production nesting/CNC maps;
  - ERP integration.

## Engine boundary

- `@2wix/spec-engine` transforms:
  - `BuildingModel` + `PanelizationResult` -> `SpecSnapshot`.
- React/UI only renders and exports derived snapshot.

## Aggregation rules

### Global aggregation

- Group by `panelTypeId` (with `code/name` from library).
- For each group:
  - `pcs` item (`qty = panel count`);
  - `m2` item (`qty = sum(width*height)`).

### Wall breakdown

Per wall:

- panel count
- trimmed count
- total area (m2)
- panel-type breakdown

## Summary fields

- `totalPanels`
- `totalTrimmedPanels`
- `totalPanelAreaM2`
- `wallCountIncluded`
- `warningCount` (panelization warnings)

## Wall-level panel type override

- Wall supports optional `panelTypeId`.
- Effective panel type:
  - wall override if valid and active;
  - otherwise global `defaultPanelTypeId`.

## Export scope

- CSV:
  - Summary
  - Aggregated BOM
  - Wall breakdown
- XLSX:
  - `Summary` sheet
  - `BOM` sheet
  - `Walls` sheet

## Spec -> Export pipeline

- Поток Sprint 11:
  - `draftModel` -> panelization snapshot -> spec snapshot;
  - export package строится из **current saved version** на API;
  - `export-engine` использует spec snapshot как источник для BOM/wall sections.
- Warnings из panelization включаются в export package и попадают в PDF/XLSX секции.

## Current limitations

- No persisted BOM object in Firestore.
- No pricing/profit fields.
- No logistics/packaging rows.
- No roof/slab items until corresponding panelization phases.
