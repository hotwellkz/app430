import type {
  BuildingModel,
  Floor,
  Opening,
  PanelSettings,
  Roof,
  Slab,
  Wall,
} from '@2wix/shared-types';
import type { ActivePanel, CanvasToolMode, EditorObjectType } from '../types/state.js';

/** Команды редактора: исполняются чистым reducer/store, без React и без HTTP. */
export type EditorCommand =
  | { type: 'setDraftModel'; model: BuildingModel }
  | { type: 'replaceDraftModel'; model: BuildingModel }
  | { type: 'resetDraftToServer' }
  | { type: 'setMetaName'; name: string }
  | { type: 'selectObject'; objectId: string; objectType: EditorObjectType }
  | { type: 'clearSelection' }
  | { type: 'setHoveredObject'; objectId: string | null; objectType: EditorObjectType | null }
  | { type: 'setActivePanel'; panel: ActivePanel }
  | { type: 'setActiveFloor'; floorId: string | null }
  | { type: 'setToolMode'; mode: CanvasToolMode }
  | { type: 'setZoom'; zoom: number }
  | { type: 'setPan'; panX: number; panY: number }
  | { type: 'toggleGrid' }
  | { type: 'toggleSnap' }
  | { type: 'addFloor'; floor: Floor }
  | {
      type: 'updateFloor';
      floorId: string;
      patch: Partial<
        Pick<Floor, 'label' | 'level' | 'elevationMm' | 'heightMm' | 'floorType' | 'sortIndex'>
      >;
    }
  | { type: 'duplicateFloor'; sourceFloorId: string }
  | { type: 'deleteFloor'; floorId: string }
  | { type: 'addWall'; wall: Wall }
  | {
      type: 'updateWall';
      wallId: string;
      patch: Partial<
        Pick<
          Wall,
          | 'floorId'
          | 'start'
          | 'end'
          | 'thicknessMm'
          | 'wallType'
          | 'structuralRole'
          | 'panelizationEnabled'
          | 'panelDirection'
          | 'panelTypeId'
          | 'heightMm'
        >
      >;
    }
  | { type: 'updatePanelSettings'; patch: Partial<PanelSettings> }
  | { type: 'deleteWall'; wallId: string }
  | { type: 'addOpening'; opening: Opening }
  | {
      type: 'updateOpening';
      openingId: string;
      patch: Partial<
        Pick<
          Opening,
          | 'wallId'
          | 'positionAlongWall'
          | 'widthMm'
          | 'heightMm'
          | 'openingType'
          | 'bottomOffsetMm'
          | 'label'
        >
      >;
    }
  | { type: 'deleteOpening'; openingId: string }
  | { type: 'addSlab'; slab: Slab }
  | {
      type: 'updateSlab';
      slabId: string;
      patch: Partial<
        Pick<
          Slab,
          | 'floorId'
          | 'slabType'
          | 'contourWallIds'
          | 'direction'
          | 'thicknessMm'
          | 'generationMode'
          | 'panelizationEnabled'
          | 'panelTypeId'
        >
      >;
    }
  | { type: 'deleteSlab'; slabId: string }
  | { type: 'addRoof'; roof: Roof }
  | {
      type: 'updateRoof';
      roofId: string;
      patch: Partial<
        Pick<
          Roof,
          | 'floorId'
          | 'roofType'
          | 'slopeDegrees'
          | 'ridgeDirection'
          | 'overhangMm'
          | 'baseElevationMm'
          | 'panelizationEnabled'
          | 'panelTypeId'
        >
      >;
    }
  | { type: 'deleteRoof'; roofId: string };

export function isModelMutationCommand(cmd: EditorCommand): boolean {
  switch (cmd.type) {
    case 'setDraftModel':
    case 'replaceDraftModel':
    case 'resetDraftToServer':
    case 'setMetaName':
    case 'addFloor':
    case 'updateFloor':
    case 'duplicateFloor':
    case 'deleteFloor':
    case 'addWall':
    case 'updateWall':
    case 'deleteWall':
    case 'updatePanelSettings':
    case 'addOpening':
    case 'updateOpening':
    case 'deleteOpening':
    case 'addSlab':
    case 'updateSlab':
    case 'deleteSlab':
    case 'addRoof':
    case 'updateRoof':
    case 'deleteRoof':
      return true;
    default:
      return false;
  }
}

/** Команды, после которых история снимков draft полностью сбрасывается. */
export function isHistoryResetCommand(cmd: EditorCommand): boolean {
  return (
    cmd.type === 'setDraftModel' ||
    cmd.type === 'replaceDraftModel' ||
    cmd.type === 'resetDraftToServer'
  );
}

