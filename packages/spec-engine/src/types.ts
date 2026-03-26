import type { PanelizationResult } from '@2wix/panel-engine';

export interface SpecItem {
  id: string;
  code: string;
  name: string;
  unit: 'pcs' | 'm2' | 'm3' | 'lm';
  qty: number;
  sourceType: 'wall_panel';
  sourceIds: string[];
  formula?: string;
  category?: string;
}

export interface WallSpecPanelTypeBreakdown {
  panelTypeId: string;
  code: string;
  name: string;
  panelCount: number;
  trimmedCount: number;
  totalAreaM2: number;
}

export interface WallSpecSummary {
  wallId: string;
  floorId: string;
  panelCount: number;
  trimmedCount: number;
  totalAreaM2: number;
  panelTypeBreakdown: WallSpecPanelTypeBreakdown[];
}

export interface SpecSummary {
  totalPanels: number;
  totalTrimmedPanels: number;
  totalPanelAreaM2: number;
  wallCountIncluded: number;
  warningCount: number;
}

export interface SpecSnapshot {
  items: SpecItem[];
  summary: SpecSummary;
  wallSummaries: WallSpecSummary[];
  warnings: PanelizationResult['warnings'];
  generatedAt: string;
}
