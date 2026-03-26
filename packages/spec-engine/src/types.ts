import type { PanelizationResult } from '@2wix/panel-engine';

export type SpecSourceType = 'wall' | 'slab' | 'roof';

export interface SpecItem {
  id: string;
  code: string;
  name: string;
  unit: 'pcs' | 'm2' | 'm3' | 'lm';
  qty: number;
  totalAreaM2?: number;
  sourceType: SpecSourceType | 'mixed';
  sourceIds: string[];
  formula?: string;
  category?: string;
  meta?: Record<string, string | number | boolean | null>;
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
  slabCountIncluded: number;
  roofCountIncluded: number;
  warningCount: number;
  totalsBySourceType: Record<SpecSourceType, { panels: number; trimmedPanels: number; areaM2: number }>;
}

export interface SourceSpecSummary {
  sourceType: SpecSourceType;
  sourceId: string;
  floorId: string;
  panelCount: number;
  trimmedCount: number;
  totalAreaM2: number;
  panelTypeBreakdown: WallSpecPanelTypeBreakdown[];
  warningsCount: number;
}

export type WallSpecSummary = SourceSpecSummary & { sourceType: 'wall'; wallId: string };
export type SlabSpecSummary = SourceSpecSummary & { sourceType: 'slab'; slabId: string };
export type RoofSpecSummary = SourceSpecSummary & { sourceType: 'roof'; roofId: string };

export interface ExpandedSpecSnapshot {
  items: SpecItem[];
  summary: SpecSummary;
  wallSummaries: WallSpecSummary[];
  slabSummaries: SlabSpecSummary[];
  roofSummaries: RoofSpecSummary[];
  warnings: PanelizationResult['warnings'];
  generatedAt: string;
}

export type SpecSnapshot = ExpandedSpecSnapshot;
