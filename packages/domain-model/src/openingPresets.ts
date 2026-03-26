import type { OpeningType } from '@2wix/shared-types';

export type OpeningSizePreset = {
  widthMm: number;
  heightMm: number;
  bottomOffsetMm: number;
};

/** Дефолтные размеры при создании проёма одним кликом по стене. */
export const OPENING_DEFAULTS: Record<OpeningType, OpeningSizePreset> = {
  window: { widthMm: 1200, heightMm: 1500, bottomOffsetMm: 900 },
  door: { widthMm: 900, heightMm: 2100, bottomOffsetMm: 0 },
  portal: { widthMm: 2000, heightMm: 2400, bottomOffsetMm: 0 },
};
