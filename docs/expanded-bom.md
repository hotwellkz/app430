# Expanded BOM (Sprint 14)

## SourceType model

Expanded BOM использует 3 sourceType:

- `wall`
- `slab`
- `roof`

Каждый spec item и object summary сохраняет traceability через `sourceIds` и `sourceType`.

## Aggregation levels

1. Global BOM (по `panelTypeId`)
   - qty (pcs)
   - area (m2)
   - sourceType info (`wall/slab/roof/mixed`)

2. Grouping by sourceType
   - отдельные секции Walls / Slabs / Roof

3. Object-level breakdown
   - `sourceId`, `floorId`
   - `panelCount`, `trimmedCount`, `totalAreaM2`
   - `panelTypeBreakdown`
   - `warningsCount`

## Example

- Один тип панели может использоваться в нескольких sourceType.
- В таком случае глобальный item маркируется как `sourceType = mixed`.
- Для детализации используются sourceType секции и object breakdown.

## Warnings in spec

- Panelization warnings пробрасываются в spec snapshot.
- `warningCount` отражается в summary.
- Объектные summaries содержат `warningsCount`.

## Current limitations

- Нет pricing/profit.
- Нет ERP/CNC/nesting.
- Нет persistence для BOM (только derived snapshot).
