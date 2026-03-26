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
  importProvenance?: VersionImportProvenance | null;
  createdAt: string;
  createdBy: string | null;
  basedOnVersionId?: string | null;
  isSnapshot?: boolean;
}

export interface VersionImportProvenance {
  sourceKind: 'ai_import';
  importJobId: string;
  mapperVersion: string;
  reviewedSnapshotVersion: string;
  appliedBy: string;
  appliedAt: string;
  warningsCount: number;
  traceCount: number;
  note?: string | null;
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

export type ImportJobStatus = 'queued' | 'running' | 'needs_review' | 'failed';

export interface ImportAssetRef {
  id: string;
  kind: 'plan' | 'facade' | 'other';
  fileName: string;
  mimeType?: string;
  widthPx?: number;
  heightPx?: number;
  storagePath?: string;
  fileUrl?: string;
}

export interface ImportConfidence {
  score: number;
  level: 'high' | 'medium' | 'low';
}

export interface ImportUnresolvedIssue {
  id: string;
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
  requiredAction?: string;
  relatedIds?: string[];
}

export type ImportIssueResolutionAction = 'confirm' | 'exclude' | 'override' | 'manual';

export interface ImportIssueResolution {
  issueId: string;
  action: ImportIssueResolutionAction;
  note?: string;
}

export interface ImportRequiredDecision {
  code:
    | 'FLOOR_HEIGHTS_REQUIRED'
    | 'ROOF_TYPE_CONFIRMATION_REQUIRED'
    | 'INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED'
    | 'SCALE_DECISION_REQUIRED'
    | 'SCALE_OVERRIDE_VALUE_REQUIRED'
    | 'BLOCKING_ISSUES_RESOLUTION_REQUIRED';
  message: string;
  satisfied: boolean;
}

export interface ImportUserDecisionSet {
  floorHeightsMmByFloorId?: Record<string, number>;
  roofTypeConfirmed?: 'gabled' | 'single-slope' | 'unknown';
  internalBearingWalls?: {
    confirmed: boolean;
    wallIds: string[];
  };
  scale?: {
    mode: 'confirmed' | 'override';
    mmPerPixel?: number | null;
  };
  issueResolutions?: ImportIssueResolution[];
}

export interface ReviewedArchitecturalSnapshot {
  baseSnapshot: ArchitecturalImportSnapshot;
  transformedSnapshot: ArchitecturalImportSnapshot;
  appliedDecisions: ImportUserDecisionSet;
  resolvedIssueIds: string[];
  notes: string[];
  generatedAt: string;
}

export type ImportReviewStatus = 'draft' | 'complete' | 'applied';
export type ImportApplyStatus = 'not_ready' | 'ready' | 'applied';

export interface ImportReviewState {
  status: ImportReviewStatus;
  applyStatus: ImportApplyStatus;
  decisions: ImportUserDecisionSet;
  missingRequiredDecisions: ImportRequiredDecision[];
  remainingBlockingIssueIds: string[];
  isReadyToApply: boolean;
  reviewedSnapshot?: ReviewedArchitecturalSnapshot | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  appliedAt?: string | null;
  appliedBy?: string | null;
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: string | null;
}

export interface CandidateWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  sourceType:
    | 'floor'
    | 'wall'
    | 'opening'
    | 'stair'
    | 'roof'
    | 'outer_contour'
    | 'dimension'
    | 'issue';
  sourceId?: string | null;
  details?: Record<string, unknown>;
}

export interface CandidateTrace {
  sourceType:
    | 'floor'
    | 'wall'
    | 'opening'
    | 'stair'
    | 'roof'
    | 'outer_contour'
    | 'dimension'
    | 'issue';
  sourceId: string;
  targetType: 'floor' | 'wall' | 'opening' | 'slab' | 'roof' | 'meta';
  targetId: string;
  rule: string;
  notes?: string[];
}

export interface BuildingModelCandidate {
  model: BuildingModel;
  warnings: CandidateWarning[];
  trace: CandidateTrace[];
  mapperVersion: string;
  generatedAt: string;
  basedOnImportJobId: string;
  basedOnReviewedSnapshotVersion: string;
  status?: 'partial' | 'ready';
}

export interface ImportEditorApplyState {
  status: 'draft' | 'candidate_ready' | 'failed';
  candidate?: BuildingModelCandidate;
  errorMessage?: string | null;
  generatedAt?: string | null;
  generatedBy?: string | null;
  mapperVersion?: string | null;
}

export interface CandidateApplySummary {
  createdOrUpdatedVersionId: string;
  appliedObjectCounts: {
    floors: number;
    walls: number;
    openings: number;
    slabs: number;
    roofs: number;
  };
  warningsCount: number;
  traceCount: number;
  basedOnImportJobId: string;
  basedOnMapperVersion: string;
  basedOnReviewedSnapshotVersion: string;
}

export interface ImportProjectApplyState {
  status: 'draft' | 'applied' | 'failed';
  appliedVersionId?: string | null;
  appliedVersionNumber?: number | null;
  appliedAt?: string | null;
  appliedBy?: string | null;
  errorMessage?: string | null;
  note?: string | null;
  summary?: CandidateApplySummary | null;
}

export interface ArchitecturalImportSnapshot {
  projectMeta: {
    name?: string;
    detectedScaleHints?: string[];
    notes?: string[];
  };
  floors: Array<{
    id: string;
    label?: string;
    elevationHintMm?: number | null;
    confidence?: ImportConfidence;
  }>;
  outerContour?:
    | {
        kind: 'polygon' | 'polyline';
        points: Array<{ x: number; y: number }>;
        confidence?: ImportConfidence;
      }
    | null;
  walls: Array<{
    id: string;
    floorId: string;
    points: Array<{ x: number; y: number }>;
    typeHint?: 'external' | 'internal';
    thicknessHintMm?: number | null;
    confidence?: ImportConfidence;
  }>;
  openings: Array<{
    id: string;
    floorId: string;
    wallId?: string | null;
    type?: 'window' | 'door' | 'unknown';
    positionAlongWallMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    confidence?: ImportConfidence;
  }>;
  stairs: Array<{
    id: string;
    floorId: string;
    polygon?: Array<{ x: number; y: number }>;
    directionHint?: 'up' | 'down' | 'unknown';
    confidence?: ImportConfidence;
  }>;
  roofHints?: {
    likelyType?: 'gabled' | 'single-slope' | 'unknown';
    confidence?: ImportConfidence;
    notes?: string[];
  } | null;
  dimensions?: Array<{
    id: string;
    label?: string;
    valueMm?: number | null;
    confidence?: ImportConfidence;
  }>;
  unresolved: ImportUnresolvedIssue[];
  notes: string[];
}

export interface ImportJob {
  id: string;
  projectId: string;
  status: ImportJobStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  importSchemaVersion: number;
  sourceImages: ImportAssetRef[];
  snapshot: ArchitecturalImportSnapshot | null;
  review?: ImportReviewState;
  editorApply?: ImportEditorApplyState;
  projectApply?: ImportProjectApplyState;
  errorMessage?: string | null;
}

export interface CreateImportJobRequest {
  sourceImages: ImportAssetRef[];
  projectName?: string;
}

export interface CreateImportJobResponse {
  job: ImportJob;
}

export interface GetImportJobResponse {
  job: ImportJob;
}

export interface ListImportJobsResponse {
  items: ImportJob[];
}

export interface SaveImportReviewRequest {
  updatedBy: string;
  decisions: Partial<ImportUserDecisionSet>;
}

export interface SaveImportReviewResponse {
  job: ImportJob;
}

export interface ApplyImportReviewRequest {
  appliedBy: string;
}

export interface ApplyImportReviewResponse {
  job: ImportJob;
  reviewedSnapshot: ReviewedArchitecturalSnapshot;
}

export interface PrepareEditorApplyRequest {
  generatedBy: string;
}

export interface PrepareEditorApplyResponse {
  job: ImportJob;
  candidate: BuildingModelCandidate;
}

export interface ApplyCandidateToProjectRequest {
  appliedBy: string;
  expectedCurrentVersionId: string;
  expectedVersionNumber: number;
  expectedSchemaVersion: number;
  note?: string;
}

export interface ApplyCandidateToProjectResponse {
  job: ImportJob;
  appliedVersionMeta: {
    id: string;
    projectId: string;
    versionNumber: number;
    schemaVersion: number;
    createdAt: string;
  };
  applySummary: CandidateApplySummary;
}

export interface ImportApplyHistoryItem {
  versionId: string;
  versionNumber: number;
  sourceKind: 'ai_import';
  importJobId: string;
  mapperVersion: string;
  reviewedSnapshotVersion: string;
  appliedBy: string;
  appliedAt: string;
  warningsCount: number;
  traceCount: number;
  note?: string | null;
  legacy?: boolean;
}

export interface GetImportApplyHistoryResponse {
  items: ImportApplyHistoryItem[];
}

/** Единый формат ошибок API. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'
  | 'IMPORT_CANDIDATE_NOT_READY'
  | 'IMPORT_REVIEW_NOT_APPLIED'
  | 'IMPORT_APPLY_CONCURRENCY_CONFLICT'
  | 'IMPORT_CANDIDATE_MISSING'
  | 'IMPORT_APPLY_FAILED';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
}
