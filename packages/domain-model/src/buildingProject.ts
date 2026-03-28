import type {
  BuildingMeta,
  BuildingMetaEditorUi,
  BuildingModel,
  BuildingSettings,
  FoundationStrip,
  GroundScreed,
  CreateProjectRequest,
  Floor,
  FloorType,
  Opening,
  OpeningType,
  Point2D,
  Project,
  ProjectStatus,
  Roof,
  RoofDrainDirection,
  Slab,
  Wall,
  WallJoint,
  WallPanelizationUiStatus,
  WallPanelLayoutResult,
  WallPanelLayoutSegment,
  WallPanelLayoutSummary,
  WallPanelLayoutWarning,
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
    wallJoints: [],
    openings: [],
    slabs: [],
    roofs: [],
    panelLibrary: [
      {
        id: 'panel-std-174',
        code: 'SIP-174-1250x2800',
        name: 'SIP 174 / 1250x2800',
        widthMm: 1250,
        heightMm: 2800,
        thicknessMm: 174,
        active: true,
      },
      {
        id: 'panel-std-174-600',
        code: 'SIP-174-600x2800',
        name: 'SIP 174 / 600x2800',
        widthMm: 600,
        heightMm: 2800,
        thicknessMm: 174,
        active: true,
      },
    ],
    panelSettings: {
      defaultPanelTypeId: 'panel-std-174',
      allowTrimmedPanels: true,
      minTrimWidthMm: 250,
      preferFullPanels: true,
      labelPrefixWall: 'W',
      labelPrefixRoof: 'R',
      labelPrefixSlab: 'S',
    },
    foundations: [],
    groundScreeds: [],
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

function parseStringBooleanRecord(v: unknown): Record<string, boolean> | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === 'boolean') out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseMetaEditorUi(m: Record<string, unknown>): BuildingMetaEditorUi | undefined {
  const raw = m.editorUi;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const u = raw as Record<string, unknown>;
  const layerVisibility = parseStringBooleanRecord(u.layerVisibility);
  const layerLocked = parseStringBooleanRecord(u.layerLocked);
  const out: BuildingMetaEditorUi = {};
  if (layerVisibility) out.layerVisibility = layerVisibility;
  if (layerLocked) out.layerLocked = layerLocked;
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePoint2DList(v: unknown): Point2D[] {
  if (!Array.isArray(v)) return [];
  const out: Point2D[] = [];
  for (const p of v) {
    if (typeof p === 'object' && p !== null && isPoint2D(p)) {
      const o = p as Point2D;
      out.push({ x: o.x, y: o.y });
    }
  }
  return out;
}

const DEFAULT_FLOOR_HEIGHT_MM = 2800;

function parseWallPanelLayouts(raw: unknown): Record<string, WallPanelLayoutResult> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, WallPanelLayoutResult> = {};
  for (const [key, val] of Object.entries(o)) {
    if (typeof val !== 'object' || val === null) continue;
    const p = val as Record<string, unknown>;
    const wallId = typeof p.wallId === 'string' ? p.wallId : key;
    const floorId = asString(p.floorId, '');
    const panelTypeId = asString(p.panelTypeId, '');
    const dir = p.direction === 'horizontal' || p.direction === 'vertical' ? p.direction : 'vertical';
    const computedAt = typeof p.computedAt === 'string' ? p.computedAt : new Date(0).toISOString();
    const status =
      p.status === 'ok' || p.status === 'partial' || p.status === 'failed' ? p.status : 'failed';
    const panelsRaw = Array.isArray(p.panels) ? p.panels : [];
    const panels: WallPanelLayoutSegment[] = panelsRaw
      .map((seg, i) => {
        if (typeof seg !== 'object' || seg === null) return null;
        const s = seg as Record<string, unknown>;
        const id = asString(s.id, `${wallId}-p-${i}`);
        const index = typeof s.index === 'number' && Number.isFinite(s.index) ? Math.round(s.index) : i + 1;
        return {
          id,
          index,
          lengthAlongWallMm: asNumber(s.lengthAlongWallMm, asNumber(s.widthMm, 0)),
          heightMm: asNumber(s.heightMm, 0),
          startOffsetMm: asNumber(s.startOffsetMm, 0),
          endOffsetMm: asNumber(s.endOffsetMm, 0),
          verticalOffsetMm: asNumber(s.verticalOffsetMm, 0),
          trimmed: Boolean(s.trimmed),
          openingAffected: Boolean(s.openingAffected),
        };
      })
      .filter((x): x is WallPanelLayoutSegment => Boolean(x));
    const warningsRaw = Array.isArray(p.warnings) ? p.warnings : [];
    const warnings: WallPanelLayoutWarning[] = warningsRaw
      .map((w) => {
        if (typeof w !== 'object' || w === null) return null;
        const x = w as Record<string, unknown>;
        const code = typeof x.code === 'string' ? x.code : 'NO_VALID_LAYOUT';
        const message = asString(x.message, '');
        const sev = x.severity === 'info' || x.severity === 'warning' || x.severity === 'error' ? x.severity : 'warning';
        return { code: code as WallPanelLayoutWarning['code'], message, severity: sev };
      })
      .filter((x): x is WallPanelLayoutWarning => Boolean(x));
    const sumRaw = p.summary;
    const summary: WallPanelLayoutSummary =
      typeof sumRaw === 'object' && sumRaw !== null
        ? (() => {
            const s = sumRaw as Record<string, unknown>;
            const openingsCount = asNumber(s.openingsCount, 0);
            const rawUi = s.panelizationStatus;
            let panelizationStatus: WallPanelizationUiStatus =
              rawUi === 'ready' || rawUi === 'partial' || rawUi === 'invalid'
                ? rawUi
                : status === 'failed'
                  ? 'invalid'
                  : status === 'partial'
                    ? 'partial'
                    : openingsCount > 0
                      ? 'partial'
                      : 'ready';
            return {
              wallLengthMm: asNumber(s.wallLengthMm, 0),
              nominalModuleMm: asNumber(s.nominalModuleMm, 0),
              panelCount: asNumber(s.panelCount, panels.length),
              trimPanelCount: asNumber(s.trimPanelCount, 0),
              remainderMm: asNumber(s.remainderMm, 0),
              utilizationRatio: asNumber(s.utilizationRatio, 0),
              openingsCount,
              fullLayoutFraction: asNumber(s.fullLayoutFraction, 0),
              panelizationStatus,
            };
          })()
        : {
            wallLengthMm: 0,
            nominalModuleMm: 0,
            panelCount: panels.length,
            trimPanelCount: 0,
            remainderMm: 0,
            utilizationRatio: 0,
            openingsCount: 0,
            fullLayoutFraction: 0,
            panelizationStatus:
              status === 'failed' ? 'invalid' : status === 'partial' ? 'partial' : 'ready',
          };
    const geometrySignature = typeof p.geometrySignature === 'string' ? p.geometrySignature : undefined;
    const stale = typeof p.stale === 'boolean' ? p.stale : undefined;
    out[wallId] = {
      wallId,
      floorId,
      panelTypeId,
      direction: dir,
      computedAt,
      panels,
      warnings,
      summary,
      status,
      ...(geometrySignature !== undefined ? { geometrySignature } : {}),
      ...(stale !== undefined ? { stale } : {}),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
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
          const editorUi = parseMetaEditorUi(m);
          if (editorUi) base.editorUi = editorUi;
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
    const structuralRole =
      w.structuralRole === 'bearing' || w.structuralRole === 'partition'
        ? w.structuralRole
        : undefined;
    const panelDirection =
      w.panelDirection === 'vertical' || w.panelDirection === 'horizontal'
        ? w.panelDirection
        : undefined;
    const panelizationEnabled =
      typeof w.panelizationEnabled === 'boolean' ? w.panelizationEnabled : undefined;
    const panelTypeId = typeof w.panelTypeId === 'string' && w.panelTypeId.trim() ? w.panelTypeId : undefined;
    const wp = w.wallPlacement;
    const wallPlacement =
      wp === 'on-axis' || wp === 'inside' || wp === 'outside' ? wp : undefined;
    const startJointId =
      typeof w.startJointId === 'string' && w.startJointId.trim() ? w.startJointId : undefined;
    const endJointId =
      typeof w.endJointId === 'string' && w.endJointId.trim() ? w.endJointId : undefined;
    return {
      ...base,
      ...(wallType !== undefined ? { wallType } : {}),
      ...(structuralRole !== undefined ? { structuralRole } : {}),
      ...(panelDirection !== undefined ? { panelDirection } : {}),
      ...(panelizationEnabled !== undefined ? { panelizationEnabled } : {}),
      ...(panelTypeId !== undefined ? { panelTypeId } : {}),
      ...(heightMm !== undefined ? { heightMm } : {}),
      ...(wallPlacement !== undefined ? { wallPlacement } : {}),
      ...(startJointId !== undefined ? { startJointId } : {}),
      ...(endJointId !== undefined ? { endJointId } : {}),
    };
  }) as Wall[];

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
    const basedOnWallIds = Array.isArray(s.basedOnWallIds)
      ? s.basedOnWallIds.filter((x): x is string => typeof x === 'string')
      : undefined;
    const contourMm = parsePoint2DList(s.contourMm);
    const ak = s.assemblyKind;
    const assemblyKind: Slab['assemblyKind'] | undefined =
      ak === 'floor_slab' || ak === 'beam_floor' || ak === 'attic_floor' ? ak : undefined;
    const sourceWallSignature =
      typeof s.sourceWallSignature === 'string' ? s.sourceWallSignature : undefined;
    const needsRecompute = typeof s.needsRecompute === 'boolean' ? s.needsRecompute : undefined;
    const elevationMm = typeof s.elevationMm === 'number' && Number.isFinite(s.elevationMm) ? s.elevationMm : undefined;
    const metadata =
      typeof s.metadata === 'object' && s.metadata !== null && !Array.isArray(s.metadata)
        ? (s.metadata as Record<string, unknown>)
        : undefined;
    const structuralHintsRaw = s.structuralHints;
    const structuralHints: Slab['structuralHints'] | undefined =
      typeof structuralHintsRaw === 'object' && structuralHintsRaw !== null
        ? (structuralHintsRaw as Slab['structuralHints'])
        : undefined;
    return {
      id: asString(s.id, `slab_${i}`),
      floorId: asString(s.floorId, floorsIn[0]?.id ?? ''),
      slabType,
      contourWallIds,
      ...(basedOnWallIds && basedOnWallIds.length > 0 ? { basedOnWallIds } : {}),
      direction: dir,
      thicknessMm: asNumber(s.thicknessMm, DEFAULT_SLAB_THICKNESS_MM),
      generationMode,
      ...(contourMm.length >= 3 ? { contourMm } : {}),
      ...(assemblyKind !== undefined ? { assemblyKind } : {}),
      ...(sourceWallSignature !== undefined ? { sourceWallSignature } : {}),
      ...(needsRecompute !== undefined ? { needsRecompute } : {}),
      ...(elevationMm !== undefined ? { elevationMm } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(structuralHints !== undefined ? { structuralHints } : {}),
      ...(typeof s.panelizationEnabled === 'boolean'
        ? { panelizationEnabled: s.panelizationEnabled }
        : {}),
      ...(typeof s.panelTypeId === 'string' && s.panelTypeId.trim()
        ? { panelTypeId: s.panelTypeId }
        : {}),
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
    const drainRaw = ro.singleSlopeDrainToward;
    const singleSlopeDrainToward: RoofDrainDirection | undefined =
      drainRaw === '+x' || drainRaw === '-x' || drainRaw === '+y' || drainRaw === '-y' ? drainRaw : undefined;
    const basedOnWallIds = Array.isArray(ro.basedOnWallIds)
      ? ro.basedOnWallIds.filter((x): x is string => typeof x === 'string')
      : undefined;
    const footprintContourMm = parsePoint2DList(ro.footprintContourMm);
    const eavesContourMm = parsePoint2DList(ro.eavesContourMm);
    const ridgeLineRaw = ro.ridgeLineMm;
    const ridgeLineMm =
      typeof ridgeLineRaw === 'object' &&
      ridgeLineRaw !== null &&
      isPoint2D((ridgeLineRaw as Record<string, unknown>).a) &&
      isPoint2D((ridgeLineRaw as Record<string, unknown>).b)
        ? {
            a: (ridgeLineRaw as { a: Point2D }).a,
            b: (ridgeLineRaw as { b: Point2D }).b,
          }
        : undefined;
    const sourceWallSignature =
      typeof ro.sourceWallSignature === 'string' ? ro.sourceWallSignature : undefined;
    const needsRecompute = typeof ro.needsRecompute === 'boolean' ? ro.needsRecompute : undefined;
    const metadata =
      typeof ro.metadata === 'object' && ro.metadata !== null
        ? (ro.metadata as Record<string, unknown>)
        : undefined;
    const structuralHintsRaw = ro.structuralHints;
    const structuralHints =
      typeof structuralHintsRaw === 'object' && structuralHintsRaw !== null
        ? (structuralHintsRaw as Roof['structuralHints'])
        : undefined;
    return {
      id: asString(ro.id, `roof_${i}`),
      floorId: asString(ro.floorId, topFloorId),
      roofType,
      slopeDegrees,
      ridgeDirection,
      ...(singleSlopeDrainToward ? { singleSlopeDrainToward } : {}),
      overhangMm: asNumber(ro.overhangMm, DEFAULT_ROOF_OVERHANG_MM),
      baseElevationMm: asNumber(ro.baseElevationMm, 0),
      generationMode: 'auto',
      ...(basedOnWallIds && basedOnWallIds.length > 0 ? { basedOnWallIds } : {}),
      ...(footprintContourMm.length >= 3 ? { footprintContourMm } : {}),
      ...(eavesContourMm.length >= 3 ? { eavesContourMm } : {}),
      ...(ridgeLineMm ? { ridgeLineMm } : {}),
      ...(sourceWallSignature !== undefined ? { sourceWallSignature } : {}),
      ...(needsRecompute !== undefined ? { needsRecompute } : {}),
      ...(metadata ? { metadata } : {}),
      ...(structuralHints ? { structuralHints } : {}),
      ...(typeof ro.panelizationEnabled === 'boolean'
        ? { panelizationEnabled: ro.panelizationEnabled }
        : {}),
      ...(typeof ro.panelTypeId === 'string' && ro.panelTypeId.trim()
        ? { panelTypeId: ro.panelTypeId }
        : {}),
    };
  });

  const libIn = mapFloors(r.panelLibrary).map((p, i) => ({
    id: asString(p.id, `panel_${i}`),
    code: asString(p.code, ''),
    name: asString(p.name, asString(p.label, '')),
    widthMm: asNumber(p.widthMm, 1250),
    heightMm: asNumber(p.heightMm, DEFAULT_FLOOR_HEIGHT_MM),
    thicknessMm: asNumber(p.thicknessMm, 174),
    active: typeof p.active === 'boolean' ? p.active : true,
  }));

  const psRaw = r.panelSettings;
  const panelSettings =
    typeof psRaw === 'object' && psRaw !== null
      ? {
          defaultPanelTypeId:
            (psRaw as Record<string, unknown>).defaultPanelTypeId === null
              ? null
              : asString((psRaw as Record<string, unknown>).defaultPanelTypeId, '') || null,
          allowTrimmedPanels:
            typeof (psRaw as Record<string, unknown>).allowTrimmedPanels === 'boolean'
              ? Boolean((psRaw as Record<string, unknown>).allowTrimmedPanels)
              : empty.panelSettings.allowTrimmedPanels,
          minTrimWidthMm: asNumber(
            (psRaw as Record<string, unknown>).minTrimWidthMm,
            empty.panelSettings.minTrimWidthMm
          ),
          preferFullPanels:
            typeof (psRaw as Record<string, unknown>).preferFullPanels === 'boolean'
              ? Boolean((psRaw as Record<string, unknown>).preferFullPanels)
              : empty.panelSettings.preferFullPanels,
          labelPrefixWall:
            asString((psRaw as Record<string, unknown>).labelPrefixWall, '') ||
            empty.panelSettings.labelPrefixWall,
          labelPrefixRoof:
            asString((psRaw as Record<string, unknown>).labelPrefixRoof, '') ||
            empty.panelSettings.labelPrefixRoof,
          labelPrefixSlab:
            asString((psRaw as Record<string, unknown>).labelPrefixSlab, '') ||
            empty.panelSettings.labelPrefixSlab,
        }
      : empty.panelSettings;

  const openingsSynced = openingsIn.map((o) => {
    const w = wallById.get(o.wallId);
    if (w && o.floorId !== w.floorId) {
      return { ...o, floorId: w.floorId };
    }
    return o;
  });

  const wallJointsIn: WallJoint[] = Array.isArray(r.wallJoints)
    ? (r.wallJoints as unknown[]).map((j, i) => {
        const o = typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : {};
        return {
          id: asString(o.id, `joint_${i}`),
          floorId: asString(o.floorId, ''),
          x: asNumber(o.x, 0),
          y: asNumber(o.y, 0),
        };
      })
    : [];

  const foundationsIn: FoundationStrip[] = Array.isArray(r.foundations)
    ? (r.foundations as unknown[]).map((raw, i) => {
        const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
        return {
          id: asString(o.id, `foundation_${i}`),
          floorId: asString(o.floorId, ''),
          kind: 'strip' as const,
          basedOnWallIds: Array.isArray(o.basedOnWallIds)
            ? o.basedOnWallIds.filter((x): x is string => typeof x === 'string')
            : [],
          outerContourMm: parsePoint2DList(o.outerContourMm),
          innerContourMm: parsePoint2DList(o.innerContourMm),
          widthMm: asNumber(o.widthMm, 300),
          heightMm: asNumber(o.heightMm, 400),
          outerOffsetMm: asNumber(o.outerOffsetMm, 50),
          innerOffsetMm: asNumber(o.innerOffsetMm, 0),
          sourceWallSignature: asString(o.sourceWallSignature, ''),
          needsRecompute: typeof o.needsRecompute === 'boolean' ? o.needsRecompute : false,
          ...(typeof o.metadata === 'object' && o.metadata !== null
            ? { metadata: o.metadata as Record<string, unknown> }
            : {}),
        };
      })
    : [];

  const groundScreedsIn: GroundScreed[] = Array.isArray(r.groundScreeds)
    ? (r.groundScreeds as unknown[]).map((raw, i) => {
        const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
        return {
          id: asString(o.id, `screed_${i}`),
          floorId: asString(o.floorId, ''),
          foundationId: asString(o.foundationId, ''),
          contourMm: parsePoint2DList(o.contourMm),
          thicknessMm: asNumber(o.thicknessMm, 80),
          needsRecompute: typeof o.needsRecompute === 'boolean' ? o.needsRecompute : false,
          ...(typeof o.metadata === 'object' && o.metadata !== null
            ? { metadata: o.metadata as Record<string, unknown> }
            : {}),
        };
      })
    : [];

  const wallPanelLayouts = parseWallPanelLayouts(r.wallPanelLayouts);

  return {
    meta,
    settings,
    floors: floorsIn,
    walls: wallsIn,
    wallJoints: wallJointsIn,
    openings: openingsSynced,
    slabs: slabsIn,
    roofs: roofsIn,
    foundations: foundationsIn,
    groundScreeds: groundScreedsIn,
    panelLibrary: libIn,
    panelSettings,
    ...(wallPanelLayouts ? { wallPanelLayouts } : {}),
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
