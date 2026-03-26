/** Чистая проверка для UI (кнопка «Удалить стену», тесты). */
export function isWallSelected(selection: {
  selectedObjectType: string | null;
  selectedObjectId: string | null;
}): boolean {
  return selection.selectedObjectType === 'wall' && selection.selectedObjectId != null;
}

export function isOpeningSelected(selection: {
  selectedObjectType: string | null;
  selectedObjectId: string | null;
}): boolean {
  return selection.selectedObjectType === 'opening' && selection.selectedObjectId != null;
}

export function canDeleteSelectedSpatial(selection: {
  selectedObjectType: string | null;
  selectedObjectId: string | null;
}): boolean {
  return isWallSelected(selection) || isOpeningSelected(selection);
}
