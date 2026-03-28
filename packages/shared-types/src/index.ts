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
  /** Проект помечен как шаблон (копии создаются через «Сохранить как»). */
  isTemplate?: boolean;
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

/** UI редактора (видимость/блокировка слоёв), сохраняется в версии проекта. */
export interface BuildingMetaEditorUi {
  layerVisibility?: Record<string, boolean>;
  layerLocked?: Record<string, boolean>;
}

/** Метаданные здания; projectId/version* синхронизируются сервисом при сохранении. */
export interface BuildingMeta {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  versionId?: string;
  versionNumber?: number;
  /** Состояние панели слоёв редактора (не доменная геометрия). */
  editorUi?: BuildingMetaEditorUi;
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

/**
 * Как линия start→end (базовая линия при построении) соотносится с осью центра стены.
 * Хранится на стене для инспектора и согласованного 2D/3D.
 */
export type WallPlacementMode = 'on-axis' | 'inside' | 'outside';
export type StructuralRole = 'bearing' | 'partition';
export type PanelDirection = 'vertical' | 'horizontal';

/**
 * Узел стыка стен (общая точка на этаже).
 * Координаты в мм; несколько стен могут ссылаться на один узел (L, T, прямоугольник).
 */
export interface WallJoint {
  id: string;
  floorId: string;
  x: number;
  y: number;
}

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
  /**
   * Режим привязки толщины к базовой линии при построении.
   * По умолчанию on-axis (центральная линия = нарисованная линия).
   */
  wallPlacement?: WallPlacementMode;
  /** Топологический узел в начале центральной линии (опционально). */
  startJointId?: string;
  /** Топологический узел в конце центральной линии (опционально). */
  endJointId?: string;
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

/** Конструктивный тип перекрытия (UI; slabType остаётся для вертикальной логики этажей). */
export type SlabAssemblyKind = 'floor_slab' | 'beam_floor' | 'attic_floor';

export interface Slab {
  id: string;
  floorId: string;
  slabType: 'ground' | 'interfloor' | 'attic';
  contourWallIds: string[];
  /** Явный список стен контура (MVP совпадает с contourWallIds). */
  basedOnWallIds?: string[];
  direction: 'x' | 'y';
  thicknessMm?: number;
  generationMode: 'auto' | 'manual';
  panelizationEnabled?: boolean;
  panelTypeId?: string;
  /** Замкнутый контур плиты в плане, мм. */
  contourMm?: Point2D[];
  assemblyKind?: SlabAssemblyKind;
  sourceWallSignature?: string;
  needsRecompute?: boolean;
  /** Нижняя грань плиты, мм (абсолютная отметка в системе этажей). */
  elevationMm?: number;
  metadata?: Record<string, unknown>;
  /** Заготовка под будущую раскладку балок / настила. */
  structuralHints?: {
    beamDirection?: 'x' | 'y';
    beamSpacingMm?: number;
  };
}

/** Направление слива односкатной крыши в плане (в сторону понижения). */
export type RoofDrainDirection = '+x' | '-x' | '+y' | '-y';

export interface Roof {
  id: string;
  floorId: string;
  roofType: 'single_slope' | 'gable';
  slopeDegrees: number;
  /** Ось конька (двускатная) или направление верхнего свеса односкатной вдоль оси X/Y. */
  ridgeDirection?: 'x' | 'y';
  /** Для односката: куда уходит вода в плане (перпендикулярно «верхнему» свесу). */
  singleSlopeDrainToward?: RoofDrainDirection;
  overhangMm: number;
  baseElevationMm: number;
  generationMode: 'auto';
  panelizationEnabled?: boolean;
  panelTypeId?: string;
  /** Наружные стены контура (порядок кольца). */
  basedOnWallIds?: string[];
  /** Контур по наружной грани SIP до свеса, мм. */
  footprintContourMm?: Point2D[];
  /** Контур карниза (с учётом свеса), мм. */
  eavesContourMm?: Point2D[];
  /** Линия конька в плане (двускатная). */
  ridgeLineMm?: { a: Point2D; b: Point2D };
  sourceWallSignature?: string;
  needsRecompute?: boolean;
  metadata?: Record<string, unknown>;
  /** Заготовка под стропила, площади скатов, материалы. */
  structuralHints?: {
    plannedKinds?: Array<'flat' | 'hip' | 'mansard'>;
    rafterSpacingMm?: number;
  };
}

/** Ленточный фундамент по наружному контуру (MVP). */
export type FoundationKind = 'strip';

export interface FoundationStrip {
  id: string;
  floorId: string;
  kind: FoundationKind;
  /** Наружные стены, по которым построен контур (порядок обхода). */
  basedOnWallIds: string[];
  /** Внешняя грань бетона (верхний полигон), мм, замкнутый CCW. */
  outerContourMm: Point2D[];
  /** Внутренняя грань ленты (к зданию), мм, замкнутый CCW. */
  innerContourMm: Point2D[];
  widthMm: number;
  heightMm: number;
  /** Вынесение наружу от наружной грани SIP, мм. */
  outerOffsetMm: number;
  /** Доп. сдвиг внутрь относительно внутренней грани ленты (MVP, мм). */
  innerOffsetMm: number;
  /** Снимок геометрии наружных стен для dirty. */
  sourceWallSignature: string;
  needsRecompute: boolean;
  metadata?: Record<string, unknown>;
}

/** Стяжка / плита пола внутри ленты фундамента. */
export interface GroundScreed {
  id: string;
  floorId: string;
  foundationId: string;
  /** Контур верхней плоскости стяжки (мм), внутри ленты. */
  contourMm: Point2D[];
  thicknessMm: number;
  needsRecompute: boolean;
  metadata?: Record<string, unknown>;
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

/** Коды предупреждений сохранённой раскладки SIP по стене (MVP). */
export type WallPanelLayoutWarningCode =
  | 'PANEL_TYPE_NOT_SET'
  | 'PANEL_DIRECTION_MISSING'
  | 'WALL_NOT_PANELIZABLE'
  | 'WALL_TOO_SHORT_FOR_PANELIZATION'
  | 'WALL_HAS_OPENINGS_NOT_FULLY_HANDLED'
  | 'WALL_HAS_OPENINGS'
  | 'OPENING_SPLIT_APPLIED'
  | 'OPENING_LAYOUT_PARTIAL'
  | 'OPENING_NOT_SUPPORTED_FOR_FULL_LAYOUT'
  | 'MULTIPLE_OPENINGS_COMPLEX_LAYOUT'
  | 'PANEL_LAYOUT_PARTIAL'
  | 'PANEL_LAYOUT_UNSUPPORTED_DIRECTION'
  | 'TRIM_TOO_SMALL'
  | 'NO_VALID_LAYOUT'
  | 'PANELIZATION_DISABLED'
  | 'INTERNAL_WALL_SKIPPED'
  | 'OPENING_TOO_CLOSE_TO_WALL_START'
  | 'OPENING_TOO_CLOSE_TO_WALL_END'
  | 'OPENING_TOO_CLOSE_TO_EDGE'
  | 'OPENING_INTERSECTS_PANEL_BOUNDARY';

export interface WallPanelLayoutWarning {
  code: WallPanelLayoutWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/** Одна панель вдоль раскладки (сегмент на стене). */
export interface WallPanelLayoutSegment {
  id: string;
  /** Порядок 1..n вдоль основной оси нарезки. */
  index: number;
  /** Размер вдоль длины стены (основной шаг модулей для vertical), мм. */
  lengthAlongWallMm: number;
  /** Высота сегмента (зона по вертикали), мм. */
  heightMm: number;
  /** Начало сегмента вдоль стены от точки start, мм. */
  startOffsetMm: number;
  /** Конец сегмента вдоль стены от точки start, мм. */
  endOffsetMm: number;
  /** Низ сегмента по высоте стены (как originYmm в движке), мм. */
  verticalOffsetMm: number;
  trimmed: boolean;
  openingAffected: boolean;
}

/** Статус панелизации стены для UX/BOM (черновик). */
export type WallPanelizationUiStatus = 'ready' | 'partial' | 'invalid';

export interface WallPanelLayoutSummary {
  wallLengthMm: number;
  nominalModuleMm: number;
  panelCount: number;
  trimPanelCount: number;
  remainderMm: number;
  /** Доля использования «полных» модулей по длине стены (0–1, упрощённо). */
  utilizationRatio: number;
  /** Число проёмов на стене на момент расчёта. */
  openingsCount: number;
  /**
   * Доля панелей в «глухих» зонах (не помеченных openingAffected) от общего числа.
   * 0 если проёмов нет или нет панелей.
   */
  fullLayoutFraction: number;
  /** Итоговый статус для спецификации: готово / частично / невалидно. */
  panelizationStatus: WallPanelizationUiStatus;
}

/**
 * Сохранённый результат расчёта панелей по стене (персистится в BuildingModel).
 * Источник истины после явного «Рассчитать панели».
 */
export interface WallPanelLayoutResult {
  wallId: string;
  floorId: string;
  panelTypeId: string;
  direction: PanelDirection;
  computedAt: string;
  panels: WallPanelLayoutSegment[];
  warnings: WallPanelLayoutWarning[];
  summary: WallPanelLayoutSummary;
  status: 'ok' | 'partial' | 'failed';
  /**
   * Подпись геометрии стены+проёмов на момент расчёта (для сравнения после правок).
   */
  geometrySignature?: string;
  /**
   * Явно устарела после правки модели (до пересчёта).
   * Если не задано — для legacy сравнивают geometrySignature.
   */
  stale?: boolean;
}

export interface BuildingModel {
  meta: BuildingMeta;
  settings: BuildingSettings;
  floors: Floor[];
  walls: Wall[];
  /** Узлы стыков стен (опционально в JSON; при отсутствии нормализуется в []). */
  wallJoints?: WallJoint[];
  openings: Opening[];
  slabs: Slab[];
  roofs: Roof[];
  /** Ленточные фундаменты по этажам (MVP — обычно один на первый этаж). */
  foundations?: FoundationStrip[];
  /** Стяжка внутри контура фундамента. */
  groundScreeds?: GroundScreed[];
  panelLibrary: PanelType[];
  panelSettings: PanelSettings;
  /**
   * Сохранённые раскладки SIP по стенам (ключ — wallId).
   * Отсутствие ключа = раскладка не считалась или очищена.
   */
  wallPanelLayouts?: Record<string, WallPanelLayoutResult>;
}

/** Черновой BOM по сохранённым раскладкам SIP (не production-final). */
export interface DraftSipBomByPanelTypeRow {
  panelTypeId: string;
  code: string;
  name: string;
  thicknessMm: number;
  panelCount: number;
  trimCount: number;
  totalAreaM2: number;
}

export interface DraftSipBomFloorAggregate {
  floorId: string;
  wallsWithLayout: number;
  sipPanelsTotal: number;
  trimPanelsTotal: number;
  wallsReady: number;
  wallsPartial: number;
  wallsInvalid: number;
  staleLayouts: number;
  warningsTotal: number;
}

export interface DraftSipBomSnapshot {
  kind: 'draft_sip_bom_v1';
  generatedAt: string;
  disclaimer: string;
  project: {
    wallsWithLayout: number;
    sipPanelsTotal: number;
    trimPanelsTotal: number;
    wallsReady: number;
    wallsPartial: number;
    wallsInvalid: number;
    staleLayouts: number;
    warningsTotal: number;
  };
  byPanelType: DraftSipBomByPanelTypeRow[];
  byFloor: DraftSipBomFloorAggregate[];
}

/** Тело POST /api/projects */
export interface CreateProjectRequest {
  dealId?: string | null;
  title?: string;
  createdBy: string;
  allowedEditorIds?: string[];
  /** Создать сразу как шаблон (редко; обычно шаблон помечают отдельно). */
  isTemplate?: boolean;
}

/** Тело POST /api/projects/:projectId/duplicate */
export interface DuplicateProjectRequest {
  title: string;
  createdBy: string;
  /** Если true — новый проект тоже будет шаблоном (по умолчанию false). */
  markAsTemplate?: boolean;
}

/** Тело PATCH /api/projects/:projectId (метаданные проекта, не версия). */
export interface PatchProjectRequest {
  updatedBy: string;
  title?: string;
  isTemplate?: boolean;
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
  /**
   * Where the import binary is stored. When set with `storagePath`, API hydrates pixels from Storage
   * before calling the extractor (base64 is not required on the wire for create-import).
   */
  storageProvider?: 'firebase';
  /** GCS bucket name (optional if server uses default from env). */
  bucket?: string;
  storagePath?: string;
  fileUrl?: string;
  /** Populated after upload; omitted from persisted job when using storage-only path. */
  sizeBytes?: number;
  checksumSha256?: string;
  /** Base64-encoded image data for AI extraction pipeline (not stored in DB). Legacy / dev path. */
  base64Data?: string;
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
    | 'INTERNAL_BEARING_WALL_IDS_REQUIRED'
    | 'INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE'
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

/** Промежуточная диагностика extraction → candidate (для логов, тестов и debug UI). */
export type ImportGeometryQualityLevel = 'good' | 'degraded' | 'minimal';

/** Как нормализация обошлась со стенами: короб по контуру, сохранение AI, смесь контура + внутренних. */
export type ImportNormalizationWallStrategy =
  | 'footprint_shell'
  | 'preserve_ai_walls'
  | 'mixed_contour_plus_ai_internals';

/** Пошаговые счётчики сегментов (import-geometry-v4+). */
export interface ImportGeometryPipelineStages {
  minSegmentMmFirstPass: number;
  segmentsAfterShortFilter: number;
  segmentsAfterRefine: number;
  /** Сегментов после rescue до footprint shell (если был lenient — это первый проход). */
  segmentsAfterRescueBeforeShell: number;
  lenientRetryUsed: boolean;
  minSegmentMmLenientPass: number | null;
  segmentsAfterShortFilterAfterLenient: number | null;
  segmentsAfterRefineAfterLenient: number | null;
  segmentsAfterRescueAfterLenient: number | null;
}

export interface ImportGeometryDiagnostics {
  /** Версия слоя нормализации (не путать с mapperVersion). */
  pipelineVersion: string;
  /** Сегментов стен из snapshot до нормализации (polyline → сегменты). */
  sourceWallSegmentCount: number;
  /** Точек внешнего контура из snapshot (если есть). */
  sourceOuterContourPointCount: number;
  /** Сегментов после фильтра коротких + refine (сетка/упрощение), до подмены контуром. */
  segmentsAfterFilterAndRefine?: number;
  /** Стратегия: контурный короб или сохранение сегментов извлечения. */
  normalizationWallStrategy?: ImportNormalizationWallStrategy;
  /** Площадь контура в мм² (shoelace), если контур валиден. */
  footprintAreaMm2: number | null;
  /** Ось-aligned bbox всех значимых точек стен/контура в мм. */
  boundingBoxMm: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Использован контур как оболочка (нет ни одного сегмента стены после фильтра/refine). */
  usedFootprintShell: boolean;
  /** Крыша добавлена в candidate-модель. */
  roofIncluded: boolean;
  /** Почему крышу не строили (если roofIncluded=false и был hint). */
  roofSuppressedReason: string | null;
  /** Итоговая оценка для quality gates и UI. */
  qualityLevel: ImportGeometryQualityLevel;
  /** Коды детерминированных fallback-правил. */
  fallbacks: string[];
  /** Короткие пояснения для разработчика. */
  notes: string[];
  /** Коды детерминированных шагов (rescue, snap, supplement). */
  geometryReasonCodes?: string[];
  /** Проёмов в snapshot на входе нормализации. */
  openingsCountIn?: number;
  /** Проёмов после нормализации (должно совпадать, если не теряли). */
  openingsCountOut?: number;
  /** Внешних сегментов стен до rescue-pass. */
  externalWallSegmentsBeforeRescue?: number;
  /** Внутренних сегментов до rescue-pass. */
  internalWallSegmentsBeforeRescue?: number;
  /** Внешних сегментов после rescue (до footprint shell). */
  externalWallSegmentsAfterRescue?: number;
  /** Внутренних сегментов после rescue. */
  internalWallSegmentsAfterRescue?: number;
  /** Был ли применён geometry rescue (snap / mixed supplement). */
  rescuePassApplied?: boolean;
  /** Детализация по стадиям нормализации (v4). */
  geometryPipelineStages?: ImportGeometryPipelineStages;
  /** Человекочитаемое объяснение выбранной стратегии стен. */
  strategyExplanation?: string;
  /** Замкнут ли outerContour (polygon). */
  outerContourClosed?: boolean;
  /** Число стен в candidate-модели после маппинга (сегменты → Wall). */
  candidateWallCount?: number;
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
  /** Диагностика нормализации геометрии (опционально, v2 pipeline). */
  geometryDiagnostics?: ImportGeometryDiagnostics;
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
  isLegacy?: boolean;
  isIncomplete?: boolean;
  missingFields?: string[];
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
