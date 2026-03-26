# Specification / BOM v2 (Sprint 14)

## Scope v2

- Source: panelization snapshot (`wall + slab + roof`).
- Includes:
  - aggregated BOM by panel type;
  - summary totals by sourceType;
  - object-level breakdown for wall/slab/roof;
  - warnings passthrough into spec snapshot.
- Excludes:
  - advanced material estimation;
  - production nesting/CNC maps;
  - ERP integration.

## Engine boundary

- `@2wix/spec-engine` transforms:
  - `BuildingModel` + `PanelizationResult` -> `SpecSnapshot`.
- React/UI only renders and exports derived snapshot.

## Aggregation rules

### Global aggregation

- Group by `panelTypeId` (with `code/name` from library), sourceType-aware.
- For each group:
  - `pcs` item (`qty = panel count`);
  - `m2` item (`qty = sum(width*height)`).
  - traceability via `sourceIds`, `sourceType`.

### SourceType sections

Sections:

- Walls
- Slabs
- Roof

### Object-level breakdown

Per object (`wallId` / `slabId` / `roofId`):

- panel count
- trimmed count
- total area (m2)
- panel-type breakdown
- warnings count

## Summary fields

- `totalPanels`
- `totalTrimmedPanels`
- `totalPanelAreaM2`
- `wallCountIncluded`
- `slabCountIncluded`
- `roofCountIncluded`
- `warningCount` (panelization warnings)
- `totalsBySourceType.wall/slab/roof`:
  - `panels`
  - `trimmedPanels`
  - `areaM2`

## Wall-level panel type override

- Wall supports optional `panelTypeId`.
- Effective panel type:
  - wall override if valid and active;
  - slab/roof override if valid and active;
  - otherwise global `defaultPanelTypeId`.

## Export scope

- CSV:
  - Summary
  - Aggregated BOM
  - Wall/Slab/Roof breakdown
- XLSX:
  - `Summary` sheet
  - `BOM` sheet
  - `Walls`/`Slabs`/`Roof` sheets

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
- Нет коммерческой калькуляции и ERP-расширений на этом этапе.
