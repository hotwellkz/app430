import type {
  BuildingMeta,
  BuildingModel,
  BuildingSettings,
  CreateProjectRequest,
  Floor,
  FloorType,
  Opening,
  OpeningType,
  Project,
  ProjectStatus,
  Roof,
  Slab,
  WallType,
} from '@2wix/shared-types';
import { BUILDING_MODEL_SCHEMA_VERSION } from '@2wix/shared-types';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createEmptyBuildingModel(): BuildingModel {
  const meta: BuildingMeta = {
    id: newId(),
    name: 'Новый объект',
    description: '',
  };

  const settings: BuildingSettings = {
    units: 'mm',
    defaultWallThicknessMm: 200,
    gridStepMm: 100,
  };

  return {
    meta,
    settings,
    floors: [],
    walls: [],
    openings: [],
    slabs: [],
    roofs: [],
    panelLibrary: [],
    panelSettings: {
      defaultSupplier: null,
      toleranceMm: 2,
    },
  };
}

export function createEmptyProject(partial?: {
  title?: string;
  dealId?: string | null;
  createdBy?: string | null;
}): Omit<
  Project,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'currentVersionId'
  | 'currentVersionNumber'
  | 'schemaVersion'
> {
  return {
    dealId: partial?.dealId ?? null,
    title: partial?.title?.trim() || 'SIP-проект',
    status: 'draft' satisfies ProjectStatus,
    createdBy: partial?.createdBy ?? null,
    updatedBy: partial?.createdBy ?? null,
  };
}

function isPoint2D(v: unknown): v is { x: number; y: number } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.x === 'number' && typeof o.y === 'number';
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function parseFloorType(v: unknown): FloorType {
  if (v === 'mansard' || v === 'basement' || v === 'full') return v;
  return 'full';
}

const DEFAULT_FLOOR_HEIGHT_MM = 2800;
const DEFAULT_SLAB_THICKNESS_MM = 220;
const DEFAULT_ROOF_OVERHANG_MM = 400;
const DEFAULT_ROOF_SLOPE_DEG = 28;

/** Приводит сырой JSON к BuildingModel с дефолтами (миграции — в следующих спринтах). */
export function normalizeBuildingModel(raw: unknown): BuildingModel {
  const empty = createEmptyBuildingModel();
  if (typeof raw !== 'object' || raw === null) {
    return empty;
  }
  const r = raw as Record<string, unknown>;

  const metaRaw = r.meta;
  const meta: BuildingMeta =
    typeof metaRaw === 'object' && metaRaw !== null
      ? (() => {
          const m = metaRaw as Record<string, unknown>;
          const base: BuildingMeta = {
            id: asString(m.id, empty.meta.id),
            name: asString(m.name, empty.meta.name),
            description: asString(m.description ?? '', ''),
          };
          if (typeof m.projectId === 'string') base.projectId = m.projectId;
          if (typeof m.versionId === 'string') base.versionId = m.versionId;
          if (typeof m.versionNumber === 'number' && Number.isFinite(m.versionNumber)) {
            base.versionNumber = m.versionNumber;
          }
          return base;
        })()
      : empty.meta;

  const settingsRaw = r.settings;
  const settings: BuildingSettings =
    typeof settingsRaw === 'object' && settingsRaw !== null
      ? {
          units:
            (settingsRaw as Record<string, unknown>).units === 'm' ? 'm' : 'mm',
          defaultWallThicknessMm: asNumber(
            (settingsRaw as Record<string, unknown>).defaultWallThicknessMm,
            empty.settings.defaultWallThicknessMm
          ),
          gridStepMm: asNumber(
            (settingsRaw as Record<string, unknown>).gridStepMm,
            empty.settings.gridStepMm
          ),
        }
      : empty.settings;

  const mapFloors = (arr: unknown) =>
    Array.isArray(arr)
      ? arr.filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
      : [];

  const floorsIn: Floor[] = mapFloors(r.floors).map((f, i) => {
    const levelRaw = f.level;
    const heightRaw = f.heightMm;
    const hasLevel = typeof levelRaw === 'number' && Number.isFinite(levelRaw);
    const hasHeight =
      typeof heightRaw === 'number' && Number.isFinite(heightRaw) && heightRaw > 0;
    return {
      id: asString(f.id, `floor_${i}`),
      label: asString(f.label, `Этаж ${i + 1}`),
      elevationMm: asNumber(f.elevationMm, 0),
      sortIndex: asNumber(f.sortIndex, i),
      level: hasLevel ? Math.max(1, Math.round(levelRaw as number)) : i + 1,
      heightMm: hasHeight ? (heightRaw as number) : DEFAULT_FLOOR_HEIGHT_MM,
      floorType: parseFloorType(f.floorType),
    };
  });
  const topFloorId = floorsIn.length > 0 ? floorsIn[floorsIn.length - 1]!.id : '';

  const wallsIn = mapFloors(r.walls).map((w, i) => {
    const wt = w.wallType;
    const wallType: WallType | undefined =
      wt === 'internal' || wt === 'external' ? wt : undefined;
    const heightRaw = w.heightMm;
    const heightMm =
      typeof heightRaw === 'number' && Number.isFinite(heightRaw) && heightRaw > 0
        ? heightRaw
        : undefined;
    const base = {
      id: asString(w.id, `wall_${i}`),
      floorId: asString(w.floorId, ''),
      start: isPoint2D(w.start) ? w.start : { x: 0, y: 0 },
      end: isPoint2D(w.end) ? w.end : { x: 0, y: 0 },
      thicknessMm: asNumber(w.thicknessMm, settings.defaultWallThicknessMm),
    };
    return {
      ...base,
      ...(wallType !== undefined ? { wallType } : {}),
      ...(heightMm !== undefined ? { heightMm } : {}),
    };
  });

  const wallById = new Map(wallsIn.map((w) => [w.id, w]));

  const openingsIn: Opening[] = mapFloors(r.openings).map((o, i) => {
    const wallId = asString(o.wallId, '');
    const wall = wallById.get(wallId);
    const otRaw = o.openingType;
    const legacyKind = o.kind;
    let openingType: OpeningType = 'door';
    if (otRaw === 'window' || otRaw === 'door' || otRaw === 'portal') {
      openingType = otRaw;
    } else if (legacyKind === 'window' || legacyKind === 'door') {
      openingType = legacyKind;
    } else if (legacyKind === 'other') {
      openingType = 'portal';
    }
    const floorIdFromJson = asString(o.floorId, '');
    const floorId = floorIdFromJson || wall?.floorId || '';
    const bottomOffsetMm = asNumber(
      o.bottomOffsetMm,
      openingType === 'window' ? 900 : 0
    );
    return {
      id: asString(o.id, `opening_${i}`),
      floorId,
      wallId,
      positionAlongWall: asNumber(o.positionAlongWall, 0),
      widthMm: asNumber(o.widthMm, 900),
      heightMm: asNumber(o.heightMm, 2100),
      bottomOffsetMm,
      openingType,
      ...(typeof o.label === 'string' && o.label ? { label: o.label } : {}),
    };
  });

  const slabsIn: Slab[] = mapFloors(r.slabs).map((s, i) => {
    const dir = s.direction === 'y' ? 'y' : 'x';
    const st = s.slabType;
    const slabType: Slab['slabType'] =
      st === 'ground' || st === 'interfloor' || st === 'attic' ? st : 'interfloor';
    const gmRaw = s.generationMode;
    const generationMode: Slab['generationMode'] = gmRaw === 'manual' ? 'manual' : 'auto';
    const contourWallIds = Array.isArray(s.contourWallIds)
      ? s.contourWallIds.filter((x): x is string => typeof x === 'string')
      : [];
    return {
      id: asString(s.id, `slab_${i}`),
      floorId: asString(s.floorId, floorsIn[0]?.id ?? ''),
      slabType,
      contourWallIds,
      direction: dir,
      thicknessMm: asNumber(s.thicknessMm, DEFAULT_SLAB_THICKNESS_MM),
      generationMode,
    };
  });

  const roofsIn: Roof[] = mapFloors(r.roofs).map((ro, i) => {
    const roofTypeRaw = ro.roofType ?? ro.kind;
    const roofType: Roof['roofType'] =
      roofTypeRaw === 'single_slope' || roofTypeRaw === 'gable'
        ? roofTypeRaw
        : roofTypeRaw === 'flat'
          ? 'single_slope'
          : 'gable';
    const slopeDegrees = asNumber(ro.slopeDegrees ?? ro.pitchDeg, DEFAULT_ROOF_SLOPE_DEG);
    const ridgeDirection: Roof['ridgeDirection'] =
      ro.ridgeDirection === 'y' || ro.ridgeDirection === 'x' ? ro.ridgeDirection : 'x';
    return {
      id: asString(ro.id, `roof_${i}`),
      floorId: asString(ro.floorId, topFloorId),
      roofType,
      slopeDegrees,
      ridgeDirection,
      overhangMm: asNumber(ro.overhangMm, DEFAULT_ROOF_OVERHANG_MM),
      baseElevationMm: asNumber(ro.baseElevationMm, 0),
      generationMode: 'auto',
    };
  });

  const libIn = mapFloors(r.panelLibrary).map((p, i) => ({
    id: asString(p.id, `panel_${i}`),
    code: asString(p.code, ''),
    thicknessMm: asNumber(p.thicknessMm, 174),
    label: asString(p.label, ''),
  }));

  const psRaw = r.panelSettings;
  const panelSettings =
    typeof psRaw === 'object' && psRaw !== null
      ? {
          defaultSupplier:
            (psRaw as Record<string, unknown>).defaultSupplier === null
              ? null
              : asString(
                  (psRaw as Record<string, unknown>).defaultSupplier,
                  ''
                ) || null,
          toleranceMm: asNumber(
            (psRaw as Record<string, unknown>).toleranceMm,
            empty.panelSettings.toleranceMm
          ),
        }
      : empty.panelSettings;

  const openingsSynced = openingsIn.map((o) => {
    const w = wallById.get(o.wallId);
    if (w && o.floorId !== w.floorId) {
      return { ...o, floorId: w.floorId };
    }
    return o;
  });

  return {
    meta,
    settings,
    floors: floorsIn,
    walls: wallsIn,
    openings: openingsSynced,
    slabs: slabsIn,
    roofs: roofsIn,
    panelLibrary: libIn,
    panelSettings,
  };
}

export { BUILDING_MODEL_SCHEMA_VERSION };

/** «Пустой» с точки зрения редактора: нет этажей и стен. */
export function isBuildingModelEmpty(model: BuildingModel): boolean {
  return model.floors.length === 0 && model.walls.length === 0;
}

export function validateProjectCreatePayload(body: unknown): CreateProjectRequest {
  if (body === null || body === undefined || typeof body !== 'object') {
    throw new Error('Тело запроса должно быть JSON-объектом');
  }
  const b = body as Record<string, unknown>;
  const createdBy = b.createdBy;
  if (typeof createdBy !== 'string' || !createdBy.trim()) {
    throw new Error('createdBy обязателен');
  }
  const title = b.title;
  const dealId = b.dealId;
  let allowedEditorIds: string[] | undefined;
  if (Array.isArray(b.allowedEditorIds)) {
    allowedEditorIds = b.allowedEditorIds.filter(
      (x): x is string => typeof x === 'string' && x.length > 0
    );
  }
  return {
    title: typeof title === 'string' ? title : undefined,
    dealId:
      dealId === null || dealId === undefined
        ? undefined
        : typeof dealId === 'string'
          ? dealId
          : undefined,
    createdBy: createdBy.trim(),
    allowedEditorIds,
  };
}
