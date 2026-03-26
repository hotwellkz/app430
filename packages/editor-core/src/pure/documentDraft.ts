import type { BuildingModel } from '@2wix/shared-types';
import { compareBuildingModelsForDirtyCheck } from '@2wix/domain-model';
import type { EditorDocumentState, SaveStatus } from '../types/state.js';

export function recomputeDocumentAfterDraftChange(
  doc: EditorDocumentState,
  draft: BuildingModel | null
): EditorDocumentState {
  if (!draft || !doc.serverModel) {
    return {
      ...doc,
      draftModel: draft,
      hasUnsavedChanges: false,
    };
  }
  const hasUnsavedChanges = !compareBuildingModelsForDirtyCheck(draft, doc.serverModel);
  const saveStatus: SaveStatus = hasUnsavedChanges ? 'dirty' : 'saved';
  return {
    ...doc,
    draftModel: draft,
    hasUnsavedChanges,
    saveStatus,
    lastError: hasUnsavedChanges ? doc.lastError : null,
  };
}
