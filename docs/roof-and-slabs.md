# Roof & Slabs MVP (Sprint 7)

## Slab model

`Slab`:

- `id`
- `floorId`
- `slabType`: `ground | interfloor | attic`
- `contourWallIds: string[]`
- `direction: x | y`
- `thicknessMm?`
- `generationMode: auto | manual`

Ограничение MVP: **одно базовое перекрытие на этаж**.

### Slab helpers

- `createSlab`
- `getDefaultSlabForFloor`
- `inferSlabTypeForFloor`
- `getSlabsByFloor`
- `validateSlab`
- `addSlabToModel`, `updateSlabInModel`, `deleteSlabFromModel`

## Roof model

`Roof`:

- `id`
- `floorId` (верхний этаж)
- `roofType`: `single_slope | gable`
- `slopeDegrees`
- `ridgeDirection?: x | y`
- `overhangMm`
- `baseElevationMm`
- `generationMode: auto`

Ограничение MVP: **одна основная крыша на проект**.

### Roof helpers

- `createRoof`
- `getRoofsByFloor`
- `getRoofForTopFloor`
- `validateRoof`
- `suggestRoofBaseElevation`
- `isTopFloor`
- `addRoofToModel`, `updateRoofInModel`, `deleteRoofFromModel`

## Defaults

- Slab:
  - `DEFAULT_SLAB_THICKNESS_MM = 220`
  - `DEFAULT_SLAB_DIRECTION = x`
- Roof:
  - `DEFAULT_ROOF_TYPE = gable`
  - `DEFAULT_ROOF_SLOPE_DEG = 28`
  - `DEFAULT_ROOF_OVERHANG_MM = 400`
  - `DEFAULT_ROOF_RIDGE_DIRECTION = x`

## UI behavior

- Левая панель:
  - quick actions: «Создать перекрытие», «Создать крышу»;
  - список перекрытий активного этажа;
  - краткая карточка крыши.
- Правая панель:
  - `SlabInspector` и `RoofInspector`.
- Canvas:
  - slab overlay (контур + стрелка направления);
  - roof overlay (контур/ridge/slope marker + label).
