import type {
  BuildingModel,
  Floor,
  Opening,
  PanelSettings,
  Roof,
  Slab,
  Wall,
  WallPlacementMode,
  WallType,
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
  | { type: 'setNewWallWallType'; wallType: WallType }
  | { type: 'setNewWallPlacement'; placement: WallPlacementMode }
  | { type: 'setActiveEditorLayer'; layerId: string | null }
  | { type: 'setLayerVisibility'; layerKey: string; visible: boolean }
  | { type: 'setLayerLocked'; layerKey: string; locked: boolean }
  | { type: 'recomputeManualGeometry' }
  | { type: 'moveWallJoint'; jointId: string; x: number; y: number }
  | { type: 'detachWallEndpoint'; wallId: string; endpoint: 'start' | 'end' }
  /** Сдвиг всей стены в мм; axis: только X, только Y или обе оси (по умолчанию both). */
  | {
      type: 'translateWall';
      wallId: string;
      dxMm: number;
      dyMm: number;
      axis?: 'x' | 'y' | 'both';
    }
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
          | 'wallPlacement'
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
          | 'basedOnWallIds'
          | 'contourMm'
          | 'assemblyKind'
          | 'sourceWallSignature'
          | 'needsRecompute'
          | 'elevationMm'
          | 'metadata'
          | 'structuralHints'
          | 'needsRecompute'
        >
      >;
    }
  | { type: 'deleteSlab'; slabId: string }
  | { type: 'createSlabFromContour'; floorId: string }
  | { type: 'recomputeSlab'; slabId: string }
  | { type: 'addRoof'; roof: Roof }
  | { type: 'createRoofFromContour'; floorId: string }
  | { type: 'recomputeRoof'; roofId: string }
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
          | 'singleSlopeDrainToward'
          | 'overhangMm'
          | 'baseElevationMm'
          | 'panelizationEnabled'
          | 'panelTypeId'
          | 'basedOnWallIds'
          | 'footprintContourMm'
          | 'eavesContourMm'
          | 'ridgeLineMm'
          | 'sourceWallSignature'
          | 'needsRecompute'
          | 'metadata'
          | 'structuralHints'
        >
      >;
    }
  | { type: 'deleteRoof'; roofId: string }
  | { type: 'createFoundationFromContour'; floorId: string }
  | {
      type: 'updateFoundation';
      foundationId: string;
      patch: {
        widthMm?: number;
        heightMm?: number;
        outerOffsetMm?: number;
        innerOffsetMm?: number;
        screedThicknessMm?: number;
      };
    }
  | { type: 'recomputeFoundation'; foundationId: string }
  | { type: 'deleteFoundation'; foundationId: string }
  /** Явный расчёт SIP-раскладки по стене (персистится в wallPanelLayouts). */
  | { type: 'calculateWallPanelLayout'; wallId: string }
  | { type: 'clearWallPanelLayout'; wallId: string }
  | { type: 'batchCalculateWallPanelLayoutsForFloor'; floorId: string }
  | { type: 'clearWallPanelLayoutsForFloor'; floorId: string }
  /** Очистить стены (и проёмы на этих стенах) на этаже. */
  | { type: 'clearFloorWallsLayer'; floorId: string }
  /** Очистить только проёмы на этаже. */
  | { type: 'clearFloorOpeningsLayer'; floorId: string }
  | { type: 'clearFoundationLayer' }
  | { type: 'clearSlabsLayer' }
  | { type: 'clearRoofsLayer' };

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
    case 'createSlabFromContour':
    case 'recomputeSlab':
    case 'addRoof':
    case 'createRoofFromContour':
    case 'recomputeRoof':
    case 'updateRoof':
    case 'deleteRoof':
    case 'createFoundationFromContour':
    case 'updateFoundation':
    case 'recomputeFoundation':
    case 'deleteFoundation':
    case 'calculateWallPanelLayout':
    case 'clearWallPanelLayout':
    case 'batchCalculateWallPanelLayoutsForFloor':
    case 'clearWallPanelLayoutsForFloor':
    case 'clearFloorWallsLayer':
    case 'clearFloorOpeningsLayer':
    case 'clearFoundationLayer':
    case 'clearSlabsLayer':
    case 'clearRoofsLayer':
    case 'recomputeManualGeometry':
    case 'moveWallJoint':
    case 'detachWallEndpoint':
    case 'translateWall':
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

