import type { ExportPresentationMode } from '@2wix/shared-types';
import type { SpecSnapshot, SpecSourceType } from '@2wix/spec-engine';

export interface CommercialItem {
  id: string;
  code: string;
  name: string;
  unit: 'pcs' | 'm2' | 'm3' | 'lm';
  qty: number;
  totalAreaM2?: number;
  sourceTypes: SpecSourceType[];
  sourceIds: string[];
  panelTypeIds: string[];
  costKey: string;
  category: string;
  group: string;
}

export interface CommercialSection {
  id: string;
  code: string;
  title: string;
  sourceTypes: SpecSourceType[];
  itemCount: number;
  totalQty: number;
  totalAreaM2: number;
  warningCount: number;
  items: CommercialItem[];
}

export interface CommercialSummary {
  totalPanels: number;
  totalAreaM2: number;
  totalSections: number;
  warningCount: number;
  totalsBySourceType: SpecSnapshot['summary']['totalsBySourceType'];
}

export interface CommercialSnapshot {
  summary: CommercialSummary;
  sections: CommercialSection[];
  groupedItems: CommercialItem[];
  warningsSummary: Array<{ code: string; count: number }>;
  basedOnVersionId?: string;
  generatedAt: string;
  presentationMode: ExportPresentationMode;
}

export interface BuildCommercialSnapshotOptions {
  basedOnVersionId?: string;
  presentationMode?: ExportPresentationMode;
}
