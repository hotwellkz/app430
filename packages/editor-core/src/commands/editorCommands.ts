import type { BuildingModel, Floor, Opening, Wall } from '@2wix/shared-types';
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
  | { type: 'deleteFloor'; floorId: string }
  | { type: 'addWall'; wall: Wall }
  | {
      type: 'updateWall';
      wallId: string;
      patch: Partial<Pick<Wall, 'floorId' | 'start' | 'end' | 'thicknessMm' | 'wallType' | 'heightMm'>>;
    }
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
  | { type: 'deleteOpening'; openingId: string };

export function isModelMutationCommand(cmd: EditorCommand): boolean {
  switch (cmd.type) {
    case 'setDraftModel':
    case 'replaceDraftModel':
    case 'resetDraftToServer':
    case 'setMetaName':
    case 'addFloor':
    case 'deleteFloor':
    case 'addWall':
    case 'updateWall':
    case 'deleteWall':
    case 'addOpening':
    case 'updateOpening':
    case 'deleteOpening':
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

