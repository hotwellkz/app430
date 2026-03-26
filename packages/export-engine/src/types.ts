import type {
  ExportPackageSnapshot,
  ExportArtifactMeta,
  ExportFormat,
  BuildingModel,
  ProjectVersion,
} from '@2wix/shared-types';
import type { PanelizationResult } from '@2wix/panel-engine';
import type { SpecSnapshot } from '@2wix/spec-engine';

export interface BuildExportPackageOptions {
  projectTitle: string;
  version: Pick<ProjectVersion, 'id' | 'versionNumber'>;
  createdBy: string | null;
}

export interface ExportTableRow {
  [key: string]: string | number;
}

export interface ExportTables {
  summaryRows: ExportTableRow[];
  bomRows: ExportTableRow[];
  wallRows: ExportTableRow[];
  slabRows: ExportTableRow[];
  roofRows: ExportTableRow[];
  warningRows: ExportTableRow[];
}

export type { ExportPackageSnapshot, ExportArtifactMeta, ExportFormat, BuildingModel, PanelizationResult, SpecSnapshot };
