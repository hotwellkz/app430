import type { OpeningType } from '@2wix/shared-types';

export type OpeningSizePreset = {
  widthMm: number;
  heightMm: number;
  bottomOffsetMm: number;
};

/**
 * Дефолтные размеры при создании проёма одним кликом по стене.
 * Менять централизованно под ручной сценарий (HouseCreator-like).
 */
export const OPENING_DEFAULTS: Record<OpeningType, OpeningSizePreset> = {
  window: { widthMm: 1250, heightMm: 1300, bottomOffsetMm: 900 },
  door: { widthMm: 900, heightMm: 2100, bottomOffsetMm: 0 },
  /** Проём / портал — универсальное отверстие в стене. */
  portal: { widthMm: 900, heightMm: 2100, bottomOffsetMm: 0 },
};
