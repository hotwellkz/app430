import type { ImportWizardFormValues, WizardFileItem } from './importWizardTypes';
import { shouldAttemptPixelRead } from './buildCreateImportRequest';

export interface WizardValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateImportWizard(
  files: WizardFileItem[],
  form: ImportWizardFormValues
): WizardValidationResult {
  const errors: string[] = [];
  if (files.length === 0) errors.push('Добавьте хотя бы один файл.');
  if (
    files.length > 0 &&
    !files.some((f) => shouldAttemptPixelRead(f.file))
  ) {
    errors.push(
      'Добавьте растровое изображение плана (PNG, JPG, WEBP и т.д.). PDF в этом режиме не передаётся в AI — экспортируйте страницу в изображение.'
    );
  }
  if (!Number.isFinite(form.floor1HeightMm) || form.floor1HeightMm <= 0) {
    errors.push('Укажите высоту 1 этажа (мм).');
  }
  if (form.floorCount === 2) {
    if (!Number.isFinite(form.floor2HeightMm) || form.floor2HeightMm <= 0) {
      errors.push('Укажите высоту 2 этажа (мм).');
    }
  }
  if (form.scale === 'exact') {
    if (!Number.isFinite(form.mmPerPixel) || form.mmPerPixel <= 0) {
      errors.push('Укажите масштаб (мм на пиксель) или выберите «без точного масштаба».');
    }
  }
  return { ok: errors.length === 0, errors };
}
