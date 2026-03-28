import { describe, expect, it } from 'vitest';
import {
  addFloorToModel,
  addOpeningToModel,
  createEmptyBuildingModel,
  createFloor,
  createWall,
} from '@2wix/domain-model';
import type { Opening } from '@2wix/shared-types';
import {
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerLocked,
  isEditorLayerVisible,
} from './editorLayers.js';
import { reduceCommand } from './pure/reduceCommand.js';
import { createInitialEditorState } from './store/editorStore.js';

function modelWithOneFloor() {
  let m = createEmptyBuildingModel();
  const floor = createFloor({
    label: 'Этаж 1',
    level: 1,
    elevationMm: 0,
    heightMm: 2800,
    floorType: 'full',
    sortIndex: 0,
  });
  m = addFloorToModel(m, floor);
  return { model: m, floorId: floor.id };
}

describe('слои редактора', () => {
  it('setLayerVisibility / setLayerLocked обновляют view', () => {
    let state = createInitialEditorState();
    const wk = editorLayerFloorWalls('f1');
    const r1 = reduceCommand(state, { type: 'setLayerVisibility', layerKey: wk, visible: false });
    expect(r1.ok).toBe(true);
    state = r1.state!;
    expect(state.view.layerVisibility[wk]).toBe(false);
    expect(isEditorLayerVisible(state.view.layerVisibility, wk)).toBe(false);

    const r2 = reduceCommand(state, { type: 'setLayerLocked', layerKey: wk, locked: true });
    expect(r2.ok).toBe(true);
    state = r2.state!;
    expect(state.view.layerLocked[wk]).toBe(true);
    expect(isEditorLayerLocked(state.view.layerLocked, wk)).toBe(true);
  });

  it('addWall сохраняет floorId; активный слой стен совпадает с этажом', () => {
    const { model, floorId } = modelWithOneFloor();
    const wk = editorLayerFloorWalls(floorId);
    let state = createInitialEditorState();
    state = {
      ...state,
      document: { ...state.document, draftModel: model, serverModel: model },
      view: {
        ...state.view,
        activeFloorId: floorId,
        activeEditorLayerId: wk,
        layerVisibility: {},
        layerLocked: {},
      },
    };
    const wall = createWall({
      floorId,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    const r = reduceCommand(state, { type: 'addWall', wall });
    expect(r.ok).toBe(true);
    const draft = r.state!.document.draftModel!;
    expect(draft.walls.some((x) => x.id === wall.id && x.floorId === floorId)).toBe(true);
  });

  it('addOpening привязан к этажу через модель', () => {
    const { model, floorId } = modelWithOneFloor();
    const w = createWall({
      floorId,
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
      wallType: 'external',
    });
    let state = createInitialEditorState();
    state = {
      ...state,
      document: { ...state.document, draftModel: model, serverModel: model },
      view: {
        ...state.view,
        activeFloorId: floorId,
        activeEditorLayerId: editorLayerFloorWalls(floorId),
        layerVisibility: {},
        layerLocked: {},
      },
    };
    const rw = reduceCommand(state, { type: 'addWall', wall: w });
    expect(rw.ok).toBe(true);
    let m = rw.state!.document.draftModel!;

    const opening: Opening = {
      id: 'o1',
      floorId,
      wallId: w.id,
      positionAlongWall: 2000,
      widthMm: 900,
      heightMm: 2100,
      bottomOffsetMm: 0,
      openingType: 'window',
    };
    const m2 = addOpeningToModel(m, opening);
    if ('ok' in m2 && m2.ok === false) throw new Error('opening');
    expect((m2 as typeof m).openings[0]!.floorId).toBe(floorId);
  });

  it('meta.editorUi восстанавливается через normalizeBuildingModel', async () => {
    const { normalizeBuildingModel } = await import('@2wix/domain-model');
    const raw = {
      meta: {
        id: 'x',
        name: 't',
        editorUi: {
          layerVisibility: { 'floor-walls:a': false },
          layerLocked: { 'floor-openings:a': true },
        },
      },
      settings: { units: 'mm', defaultWallThicknessMm: 200, gridStepMm: 100 },
      floors: [],
      walls: [],
      openings: [],
      slabs: [],
      roofs: [],
      panelLibrary: [],
      panelSettings: {
        defaultPanelTypeId: null,
        allowTrimmedPanels: true,
        minTrimWidthMm: 250,
        preferFullPanels: true,
        labelPrefixWall: 'W',
        labelPrefixRoof: 'R',
        labelPrefixSlab: 'S',
      },
    };
    const norm = normalizeBuildingModel(raw);
    expect(norm.meta.editorUi?.layerVisibility?.['floor-walls:a']).toBe(false);
    expect(norm.meta.editorUi?.layerLocked?.['floor-openings:a']).toBe(true);
  });
});
