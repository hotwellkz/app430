import type {
  ExportPackageSnapshot,
  ExportArtifactMeta,
  ExportFormat,
  ExportPresentationMode,
  BuildingModel,
  ProjectVersion,
} from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type { SpecSnapshot } from '@2wix/spec-engine';
import type { CommercialSnapshot } from '@2wix/commercial-engine';

export interface BuildExportPackageOptions {
  projectTitle: string;
  version: Pick<ProjectVersion, 'id' | 'versionNumber'>;
  createdBy: string | null;
  presentationMode?: ExportPresentationMode;
}

export interface ExportTableRow {
  [key: string]: string | number;
}

export interface ExportTables {
  presentationMode: ExportPresentationMode;
  summaryRows: ExportTableRow[];
  bomRows: ExportTableRow[];
  commercialRows: ExportTableRow[];
  sectionRows: ExportTableRow[];
  wallRows: ExportTableRow[];
  slabRows: ExportTableRow[];
  roofRows: ExportTableRow[];
  warningRows: ExportTableRow[];
}

export type {
  ExportPackageSnapshot,
  ExportArtifactMeta,
  ExportFormat,
  ExportPresentationMode,
  BuildingModel,
  PanelizationResult,
  SpecSnapshot,
  CommercialSnapshot,
};
