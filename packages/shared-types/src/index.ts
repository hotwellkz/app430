/** Схема доменной модели здания (версионируется в ProjectVersion). */
export const BUILDING_MODEL_SCHEMA_VERSION = 2 as const;

export type ProjectStatus = 'draft' | 'calculated' | 'reviewed' | 'approved';

export interface Project {
  id: string;
  dealId: string | null;
  title: string;
  status: ProjectStatus;
  currentVersionId: string | null;
  /** Дублируется с текущей версией для быстрых списков и optimistic concurrency. */
  currentVersionNumber: number | null;
  /** Схема BuildingModel у текущей рабочей версии. */
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  /** Пустой/отсутствующий = правило «только createdBy» (или legacy). */
  allowedEditorIds?: string[];
  lastCalculatedAt?: string | null;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  schemaVersion: number;
  buildingModel: BuildingModel;
  createdAt: string;
  createdBy: string | null;
  basedOnVersionId?: string | null;
  isSnapshot?: boolean;
}

/** Метаданные здания; projectId/version* синхронизируются сервисом при сохранении. */
export interface BuildingMeta {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  versionId?: string;
  versionNumber?: number;
}

export interface BuildingSettings {
  units: 'mm' | 'm';
  defaultWallThicknessMm: number;
  gridStepMm: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/** Тип этажа (планировка/учёт; не кровля/плиты). */
export type FloorType = 'full' | 'mansard' | 'basement';

export interface Floor {
  id: string;
  /** Отображаемое имя этажа. */
  label: string;
  /** Порядковый уровень (1 = первый над условным нулём, для UX и спецификации). */
  level: number;
  /** Отметка низа этажа, мм (глобальная). */
  elevationMm: number;
  /** Высота этажа (до перекрытия), мм. */
  heightMm: number;
  floorType: FloorType;
  /** Порядок в списках UI (независимо от физической отметки). */
  sortIndex: number;
}

/** Тип стены для отображения и спецификации (по умолчанию в нормализации — external). */
export type WallType = 'external' | 'internal';
export type StructuralRole = 'bearing' | 'partition';
export type PanelDirection = 'vertical' | 'horizontal';

export interface Wall {
  id: string;
  floorId: string;
  start: Point2D;
  end: Point2D;
  thicknessMm: number;
  wallType?: WallType;
  structuralRole?: StructuralRole;
  panelizationEnabled?: boolean;
  panelDirection?: PanelDirection;
  panelTypeId?: string;
  /** Высота стены в мм (опционально, для панелей и спецификации). */
  heightMm?: number;
}

/** Тип проёма в редакторе и спецификации. */
export type OpeningType = 'window' | 'door' | 'portal';

export interface Opening {
  id: string;
  /** Этаж (денормализация для списков и фильтрации; должен совпадать со стеной). */
  floorId: string;
  wallId: string;
  /** Центр проёма вдоль оси стены от точки start, мм. */
  positionAlongWall: number;
  widthMm: number;
  heightMm: number;
  /** Отступ низа проёма от условного «пола» 2D-среза, мм. */
  bottomOffsetMm: number;
  openingType: OpeningType;
  label?: string;
}

export interface Slab {
  id: string;
  floorId: string;
  slabType: 'ground' | 'interfloor' | 'attic';
  contourWallIds: string[];
  direction: 'x' | 'y';
  thicknessMm?: number;
  generationMode: 'auto' | 'manual';
  panelizationEnabled?: boolean;
  panelTypeId?: string;
}

export interface Roof {
  id: string;
  floorId: string;
  roofType: 'single_slope' | 'gable';
  slopeDegrees: number;
  ridgeDirection?: 'x' | 'y';
  overhangMm: number;
  baseElevationMm: number;
  generationMode: 'auto';
  panelizationEnabled?: boolean;
  panelTypeId?: string;
}

export interface PanelType {
  id: string;
  code: string;
  name: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  active: boolean;
}

export interface PanelSettings {
  defaultPanelTypeId: string | null;
  allowTrimmedPanels: boolean;
  minTrimWidthMm: number;
  preferFullPanels: boolean;
  labelPrefixWall: string;
  labelPrefixRoof: string;
  labelPrefixSlab: string;
}

export interface BuildingModel {
  meta: BuildingMeta;
  settings: BuildingSettings;
  floors: Floor[];
  walls: Wall[];
  openings: Opening[];
  slabs: Slab[];
  roofs: Roof[];
  panelLibrary: PanelType[];
  panelSettings: PanelSettings;
}

/** Тело POST /api/projects */
export interface CreateProjectRequest {
  dealId?: string | null;
  title?: string;
  createdBy: string;
  allowedEditorIds?: string[];
}

/** Тело POST /api/projects/:id/versions */
export type CreateVersionMode = 'clone-current' | 'from-version';

export interface CreateVersionRequest {
  createdBy: string;
  basedOnVersionId?: string | null;
  mode?: CreateVersionMode;
}

/** Тело PATCH /api/projects/:id/current-version */
export interface PatchCurrentVersionRequestBody {
  buildingModel: BuildingModel;
  updatedBy: string;
  expectedCurrentVersionId: string;
  expectedVersionNumber: number;
  expectedSchemaVersion: number;
}

/** Детали 409 CONFLICT при сохранении. */
export interface VersionConflictDetails {
  currentVersionId: string;
  currentVersionNumber: number;
  serverUpdatedAt: string;
}

/** Ответ API: проект + опционально текущая версия */
export interface ProjectWithCurrentVersion {
  project: Project;
  currentVersion: ProjectVersion | null;
}

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';
export type ExportPresentationMode = 'technical' | 'commercial';

export type ExportStatus = 'pending' | 'ready' | 'failed';

export interface ExportArtifactMeta {
  id: string;
  projectId: string;
  versionId: string;
  format: ExportFormat;
  presentationMode?: ExportPresentationMode;
  title: string;
  createdAt: string;
  createdBy: string | null;
  status: ExportStatus;
  fileName: string;
  storagePath?: string | null;
  fileUrl?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  errorMessage?: string | null;
  retryCount?: number;
  completedAt?: string | null;
}

export interface ExportPackageProjectSummary {
  projectId: string;
  projectTitle: string;
  versionId: string;
  versionNumber: number;
  generatedBy: string | null;
  floorsCount: number;
}

export interface ExportPackageSnapshot {
  presentationMode?: ExportPresentationMode;
  projectSummary: ExportPackageProjectSummary;
  wallSummaries: Array<{
    wallId: string;
    floorId: string;
    panelCount: number;
    trimmedCount: number;
    totalAreaM2: number;
    warningCount: number;
  }>;
  slabSummaries?: Array<{
    slabId: string;
    floorId: string;
    panelCount: number;
    trimmedCount: number;
    totalAreaM2: number;
    warningCount: number;
  }>;
  roofSummaries?: Array<{
    roofId: string;
    floorId: string;
    panelCount: number;
    trimmedCount: number;
    totalAreaM2: number;
    warningCount: number;
  }>;
  panelizationSummary: {
    eligibleWalls: number;
    panelizedWalls: number;
    eligibleSlabs?: number;
    panelizedSlabs?: number;
    eligibleRoofs?: number;
    panelizedRoofs?: number;
    wallPanels?: number;
    slabPanels?: number;
    roofPanels?: number;
    trimmedPanels?: number;
    generatedPanels: number;
    warnings: number;
    errors: number;
  };
  specSummary: {
    totalPanels: number;
    totalTrimmedPanels: number;
    totalPanelAreaM2: number;
    wallCountIncluded: number;
    slabCountIncluded?: number;
    roofCountIncluded?: number;
    warningCount: number;
    totalsBySourceType?: {
      wall: { panels: number; trimmedPanels: number; areaM2: number };
      slab: { panels: number; trimmedPanels: number; areaM2: number };
      roof: { panels: number; trimmedPanels: number; areaM2: number };
    };
  };
  aggregatedSpecItems: Array<{
    id: string;
    code: string;
    name: string;
    unit: 'pcs' | 'm2' | 'm3' | 'lm';
    qty: number;
    category?: string;
    sourceIds: string[];
  }>;
  commercialSections?: Array<{
    id: string;
    code: string;
    title: string;
    sourceTypes: Array<'wall' | 'slab' | 'roof'>;
    itemCount: number;
    totalQty: number;
    totalAreaM2: number;
    warningCount: number;
  }>;
  commercialItems?: Array<{
    id: string;
    code: string;
    name: string;
    unit: 'pcs' | 'm2' | 'm3' | 'lm';
    qty: number;
    totalAreaM2?: number;
    sourceTypes: Array<'wall' | 'slab' | 'roof'>;
    sourceIds: string[];
    panelTypeIds: string[];
    costKey?: string;
    category?: string;
    group?: string;
  }>;
  warnings: Array<{
    id: string;
    code: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    relatedObjectIds: string[];
  }>;
  panelSettings: PanelSettings;
  generatedAt: string;
  basedOnVersionId: string;
}

export interface CreateExportRequest {
  createdBy: string;
  format: ExportFormat;
  presentationMode?: ExportPresentationMode;
  title?: string;
  retryOfExportId?: string;
}

export interface CreateExportResponse {
  artifact: ExportArtifactMeta;
  snapshot: ExportPackageSnapshot;
}

/** Единый формат ошибок API. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
}
