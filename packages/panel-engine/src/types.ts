import type { PanelDirection } from '@2wix/shared-types';

export type PanelizationWarningSeverity = 'info' | 'warning' | 'error';

export type PanelizationWarningCode =
  | 'PANEL_TYPE_NOT_SET'
  | 'PANEL_DIRECTION_MISSING'
  | 'TRIM_TOO_SMALL'
  | 'OPENING_TOO_CLOSE_TO_WALL_START'
  | 'OPENING_TOO_CLOSE_TO_WALL_END'
  | 'PANELIZATION_DISABLED'
  | 'WALL_TOO_SHORT_FOR_LAYOUT'
  | 'NO_VALID_LAYOUT'
  | 'INTERNAL_WALL_SKIPPED'
  | 'ROOF_NOT_SUPPORTED_YET'
  | 'SLAB_NOT_SUPPORTED_YET';

export interface GeneratedPanel {
  id: string;
  sourceType: 'wall';
  sourceId: string;
  floorId: string;
  panelTypeId: string;
  orientation: PanelDirection;
  originXmm: number;
  originYmm: number;
  widthMm: number;
  heightMm: number;
  trimmed: boolean;
  label: string;
  zoneType?: 'main' | 'left_of_opening' | 'right_of_opening' | 'above_opening' | 'below_opening';
}

export interface PanelizationWarning {
  id: string;
  severity: PanelizationWarningSeverity;
  code: PanelizationWarningCode;
  message: string;
  relatedObjectIds: string[];
}

export interface WallPanelizationSummary {
  wallId: string;
  floorId: string;
  eligible: boolean;
  reason?: string;
  direction: PanelDirection | null;
  panelCount: number;
  warningCount: number;
}

export interface PanelizationStats {
  eligibleWalls: number;
  panelizedWalls: number;
  generatedPanels: number;
  warnings: number;
  errors: number;
}

export interface PanelizationResult {
  generatedPanels: GeneratedPanel[];
  warnings: PanelizationWarning[];
  stats: PanelizationStats;
  wallSummaries: WallPanelizationSummary[];
}

export interface BuildPanelizationOptions {
  includeNonBearingInternalWalls?: boolean;
}
