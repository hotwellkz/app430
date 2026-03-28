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
  | 'WALL_TOO_SHORT_FOR_PANELIZATION'
  | 'WALL_NOT_PANELIZABLE'
  | 'WALL_HAS_OPENINGS_NOT_FULLY_HANDLED'
  | 'WALL_HAS_OPENINGS'
  | 'OPENING_SPLIT_APPLIED'
  | 'OPENING_LAYOUT_PARTIAL'
  | 'OPENING_NOT_SUPPORTED_FOR_FULL_LAYOUT'
  | 'MULTIPLE_OPENINGS_COMPLEX_LAYOUT'
  | 'OPENING_TOO_CLOSE_TO_EDGE'
  | 'OPENING_INTERSECTS_PANEL_BOUNDARY'
  | 'PANEL_LAYOUT_PARTIAL'
  | 'PANEL_LAYOUT_UNSUPPORTED_DIRECTION'
  | 'NO_VALID_LAYOUT'
  | 'INTERNAL_WALL_SKIPPED'
  | 'SLAB_NOT_PANELIZABLE'
  | 'SLAB_TOO_SMALL'
  | 'SLAB_DIRECTION_MISSING'
  | 'NO_VALID_SLAB_LAYOUT'
  | 'ROOF_NOT_PANELIZABLE'
  | 'ROOF_TYPE_NOT_SUPPORTED'
  | 'ROOF_SLOPE_INVALID'
  | 'NO_VALID_ROOF_LAYOUT'
  | 'ROOF_GEOMETRY_INCOMPLETE';

export interface GeneratedPanel {
  id: string;
  sourceType: 'wall' | 'slab' | 'roof';
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
  zoneType?:
    | 'main'
    | 'left_of_opening'
    | 'right_of_opening'
    | 'above_opening'
    | 'below_opening'
    | 'slab'
    | 'roof_slope_a'
    | 'roof_slope_b';
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
  effectivePanelTypeId: string | null;
  panelCount: number;
  warningCount: number;
}

export interface PanelizationStats {
  eligibleWalls: number;
  panelizedWalls: number;
  eligibleSlabs: number;
  panelizedSlabs: number;
  eligibleRoofs: number;
  panelizedRoofs: number;
  wallPanels: number;
  slabPanels: number;
  roofPanels: number;
  trimmedPanels: number;
  generatedPanels: number;
  warnings: number;
  errors: number;
}

export interface SlabPanelizationSummary {
  slabId: string;
  floorId: string;
  eligible: boolean;
  reason?: string;
  direction: 'x' | 'y' | null;
  effectivePanelTypeId: string | null;
  panelCount: number;
  trimmedCount: number;
  totalAreaM2: number;
  warningCount: number;
}

export interface RoofPanelizationSummary {
  roofId: string;
  floorId: string;
  eligible: boolean;
  reason?: string;
  roofType: 'single_slope' | 'gable' | null;
  slopeSections: number;
  effectivePanelTypeId: string | null;
  panelCount: number;
  trimmedCount: number;
  totalAreaM2: number;
  warningCount: number;
}

export interface PanelizationResult {
  generatedPanels: GeneratedPanel[];
  warnings: PanelizationWarning[];
  stats: PanelizationStats;
  wallSummaries: WallPanelizationSummary[];
  slabSummaries: SlabPanelizationSummary[];
  roofSummaries: RoofPanelizationSummary[];
}

export interface BuildPanelizationOptions {
  includeNonBearingInternalWalls?: boolean;
}
