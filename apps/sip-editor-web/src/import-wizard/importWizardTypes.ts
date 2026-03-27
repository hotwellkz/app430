/** Классификация файла пользователем. */
export type WizardFileKind = 'plan' | 'facade' | 'other';

export interface WizardFileItem {
  /** Стабильный id в UI (не путать с ImportAssetRef.id на сервере). */
  clientId: string;
  file: File;
  kind: WizardFileKind;
}

/** Тип крыши в мастере. */
export type WizardRoofChoice = 'gabled' | 'single-slope' | 'unknown';

/** Масштаб: точный mm/px или «подтвердить авто». */
export type WizardScaleChoice = 'exact' | 'auto';

/** Внутренние несущие — заготовка для review. */
export type WizardInternalBearingChoice = 'none' | 'confirm_in_review' | 'unsure';

export interface ImportWizardFormValues {
  floorCount: 1 | 2;
  /** мм, обязательно */
  floor1HeightMm: number;
  /** мм, если floorCount === 2 */
  floor2HeightMm: number;
  roof: WizardRoofChoice;
  scale: WizardScaleChoice;
  /** если scale === 'exact' */
  mmPerPixel: number;
  internalBearing: WizardInternalBearingChoice;
}

export const defaultImportWizardForm = (): ImportWizardFormValues => ({
  floorCount: 1,
  floor1HeightMm: 2800,
  floor2HeightMm: 2800,
  roof: 'unknown',
  scale: 'auto',
  mmPerPixel: 1,
  internalBearing: 'unsure',
});
