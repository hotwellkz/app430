# Commercial Layer (Sprint 15)

## Purpose

`CommercialSnapshot` — derived business-friendly представление поверх expanded technical spec.

Поток:

- `BuildingModel`
- `PanelizationSnapshot`
- `ExpandedSpecSnapshot`
- `CommercialSnapshot`

Ни один из этих промежуточных snapshot не становится persisted source of truth.

## Engine boundary

- Пакет: `@2wix/commercial-engine`
- Вход: `SpecSnapshot`
- Выход: `CommercialSnapshot`

## Snapshot structure

- `summary`
- `sections` (Walls/Slabs/Roof)
- `groupedItems`
- `warningsSummary`
- `basedOnVersionId`
- `generatedAt`

## Grouping rules

- Секции:
  - Walls
  - Slabs
  - Roof
- Внутри:
  - агрегация по code/name/unit
  - totals qty/area
  - warning count per section

## Cost-ready hooks

- Каждый commercial item получает `costKey`.
- На текущем этапе **нет**:
  - unitPrice
  - totalPrice
  - discount/tax/profit

Это intentionally-only structure для будущего pricing layer.

## Warnings in commercial context

- Commercial mode показывает краткий warnings summary.
- Документ не скрывает факт проблемной геометрии/layout.
- Детальные инженерные warnings остаются в technical mode.

## Current limitations

- Нет real pricing engine.
- Нет ERP/warehouse integration.
- Нет коммерческого workflow согласования/подписания.
