import {
  computeWallLengthMm,
  computeWallPanelizationGeometrySignature,
  getEffectiveWallHeight,
  getFloorById,
  getOpeningsByWall,
  getWallById,
  getWallsByFloor,
} from '@2wix/domain-model';
import type {
  BuildingModel,
  Opening,
  PanelDirection,
  PanelType,
  Wall,
  WallPanelLayoutResult,
  WallPanelLayoutSegment,
  WallPanelLayoutSummary,
  WallPanelLayoutWarning,
  WallPanelLayoutWarningCode,
  WallPanelizationUiStatus,
} from '@2wix/shared-types';
import type {
  GeneratedPanel,
  PanelizationWarning,
  PanelizationWarningCode,
  WallPanelizationSummary,
} from './types.js';

interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
  zoneType: GeneratedPanel['zoneType'];
}

function makeWarning(
  code: PanelizationWarningCode,
  severity: PanelizationWarning['severity'],
  message: string,
  relatedObjectIds: string[]
): PanelizationWarning {
  return {
    id: `${code}-${relatedObjectIds.join('-')}-${message.slice(0, 40)}`,
    code,
    severity,
    message,
    relatedObjectIds,
  };
}

export function isWallEligibleForPanelization(wall: Wall): { eligible: boolean; reason?: string } {
  if (wall.panelizationEnabled === false) return { eligible: false, reason: 'disabled' };
  if (wall.wallType !== 'internal') return { eligible: true };
  if (wall.structuralRole !== 'bearing') return { eligible: false, reason: 'internal_non_bearing' };
  return { eligible: true };
}

function resolvePanelDirection(wall: Wall): PanelDirection | null {
  if (wall.panelDirection === 'vertical' || wall.panelDirection === 'horizontal') {
    return wall.panelDirection;
  }
  return null;
}

function resolvePanelTypeById(model: BuildingModel, id: string | null | undefined): PanelType | null {
  if (!id) return null;
  const found = model.panelLibrary.find((p) => p.id === id && p.active);
  return found ?? null;
}

function resolveEffectivePanelType(model: BuildingModel, wall: Wall): PanelType | null {
  const local = resolvePanelTypeById(model, wall.panelTypeId);
  if (local) return local;
  return resolvePanelTypeById(model, model.panelSettings.defaultPanelTypeId);
}

function splitByOpenings(lengthMm: number, openings: Opening[]): Array<{ start: number; end: number }> {
  const spans = openings
    .map((o) => {
      const half = o.widthMm / 2;
      return {
        start: Math.max(0, o.positionAlongWall - half),
        end: Math.min(lengthMm, o.positionAlongWall + half),
      };
    })
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (spans.length === 0) return [{ start: 0, end: lengthMm }];
  const out: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) out.push({ start: cursor, end: span.start });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < lengthMm) out.push({ start: cursor, end: lengthMm });
  return out;
}

function buildZones(
  wallLengthMm: number,
  wallHeightMm: number,
  openings: Opening[]
): ZoneRect[] {
  const baseSegments = splitByOpenings(wallLengthMm, openings);
  const zones: ZoneRect[] = baseSegments
    .filter((s) => s.end - s.start > 1)
    .map((s) => ({ x: s.start, y: 0, width: s.end - s.start, height: wallHeightMm, zoneType: 'main' }));

  for (const opening of openings) {
    const left = Math.max(0, opening.positionAlongWall - opening.widthMm / 2);
    const right = Math.min(wallLengthMm, opening.positionAlongWall + opening.widthMm / 2);
    const top = Math.max(0, opening.bottomOffsetMm + opening.heightMm);
    if (top < wallHeightMm) {
      zones.push({
        x: left,
        y: top,
        width: right - left,
        height: wallHeightMm - top,
        zoneType: 'above_opening',
      });
    }
    if (opening.openingType === 'window' && opening.bottomOffsetMm > 0) {
      zones.push({
        x: left,
        y: 0,
        width: right - left,
        height: opening.bottomOffsetMm,
        zoneType: 'below_opening',
      });
    }
  }

  return zones.filter((z) => z.width > 1 && z.height > 1);
}

function buildPanelsForZone(
  zone: ZoneRect,
  wall: Wall,
  floorLevel: number,
  wallIndex: number,
  direction: PanelDirection,
  panelType: PanelType,
  model: BuildingModel,
  panelStartIndex: number
): { panels: GeneratedPanel[]; warnings: PanelizationWarning[] } {
  const warnings: PanelizationWarning[] = [];
  const panels: GeneratedPanel[] = [];
  const splitSize = direction === 'vertical' ? panelType.widthMm : panelType.heightMm;
  const axisLength = direction === 'vertical' ? zone.width : zone.height;
  const unitCount = Math.floor(axisLength / splitSize);
  const remainder = axisLength - unitCount * splitSize;
  const allowTrim = model.panelSettings.allowTrimmedPanels;
  const minTrim = model.panelSettings.minTrimWidthMm;
  if (axisLength < splitSize && (!allowTrim || axisLength < minTrim)) {
    warnings.push(
      makeWarning(
        'WALL_TOO_SHORT_FOR_PANELIZATION',
        'warning',
        `Стена ${wall.id} слишком короткая для раскладки`,
        [wall.id]
      )
    );
    return { panels: [], warnings };
  }
  if (remainder > 0 && (!allowTrim || remainder < minTrim)) {
    warnings.push(
      makeWarning(
        'TRIM_TOO_SMALL',
        'warning',
        `Остаток ${Math.round(remainder)} мм меньше minTrimWidthMm (${minTrim})`,
        [wall.id]
      )
    );
    if (!allowTrim || remainder < minTrim) {
      warnings.push(
        makeWarning('NO_VALID_LAYOUT', 'error', `Нет валидной раскладки для стены ${wall.id}`, [
          wall.id,
        ])
      );
      return { panels: [], warnings };
    }
  }

  const total = unitCount + (remainder > 0 ? 1 : 0);
  for (let i = 0; i < total; i += 1) {
    const isTrim = remainder > 0 && i === total - 1;
    const size = isTrim ? remainder : splitSize;
    if (size <= 0) continue;
    const offset = i * splitSize;
    const originX = direction === 'vertical' ? zone.x + offset : zone.x;
    const originY = direction === 'vertical' ? zone.y : zone.y + offset;
    const width = direction === 'vertical' ? size : zone.width;
    const height = direction === 'vertical' ? zone.height : size;
    const panelIndex = panelStartIndex + panels.length + 1;
    const label = `${model.panelSettings.labelPrefixWall || 'W'}-${floorLevel}-${wallIndex}-${panelIndex}`;
    panels.push({
      id: `${wall.id}-${label}`,
      sourceType: 'wall',
      sourceId: wall.id,
      floorId: wall.floorId,
      panelTypeId: panelType.id,
      orientation: direction,
      originXmm: originX,
      originYmm: originY,
      widthMm: width,
      heightMm: height,
      trimmed: isTrim,
      label,
      zoneType: zone.zoneType,
    });
  }
  return { panels, warnings };
}

function mapEngineCodeToLayoutCode(code: PanelizationWarningCode): WallPanelLayoutWarningCode {
  switch (code) {
    case 'WALL_TOO_SHORT_FOR_LAYOUT':
    case 'WALL_TOO_SHORT_FOR_PANELIZATION':
      return 'WALL_TOO_SHORT_FOR_PANELIZATION';
    case 'PANEL_TYPE_NOT_SET':
      return 'PANEL_TYPE_NOT_SET';
    case 'PANEL_DIRECTION_MISSING':
      return 'PANEL_DIRECTION_MISSING';
    case 'PANELIZATION_DISABLED':
      return 'PANELIZATION_DISABLED';
    case 'INTERNAL_WALL_SKIPPED':
      return 'INTERNAL_WALL_SKIPPED';
    case 'TRIM_TOO_SMALL':
      return 'TRIM_TOO_SMALL';
    case 'NO_VALID_LAYOUT':
      return 'NO_VALID_LAYOUT';
    case 'OPENING_TOO_CLOSE_TO_WALL_START':
      return 'OPENING_TOO_CLOSE_TO_WALL_START';
    case 'OPENING_TOO_CLOSE_TO_WALL_END':
      return 'OPENING_TOO_CLOSE_TO_WALL_END';
    case 'OPENING_TOO_CLOSE_TO_EDGE':
      return 'OPENING_TOO_CLOSE_TO_EDGE';
    case 'PANEL_LAYOUT_PARTIAL':
      return 'PANEL_LAYOUT_PARTIAL';
    case 'WALL_HAS_OPENINGS_NOT_FULLY_HANDLED':
      return 'WALL_HAS_OPENINGS_NOT_FULLY_HANDLED';
    case 'WALL_HAS_OPENINGS':
      return 'WALL_HAS_OPENINGS';
    case 'OPENING_SPLIT_APPLIED':
      return 'OPENING_SPLIT_APPLIED';
    case 'OPENING_LAYOUT_PARTIAL':
      return 'OPENING_LAYOUT_PARTIAL';
    case 'OPENING_NOT_SUPPORTED_FOR_FULL_LAYOUT':
      return 'OPENING_NOT_SUPPORTED_FOR_FULL_LAYOUT';
    case 'MULTIPLE_OPENINGS_COMPLEX_LAYOUT':
      return 'MULTIPLE_OPENINGS_COMPLEX_LAYOUT';
    case 'OPENING_INTERSECTS_PANEL_BOUNDARY':
      return 'OPENING_INTERSECTS_PANEL_BOUNDARY';
    case 'WALL_NOT_PANELIZABLE':
      return 'WALL_NOT_PANELIZABLE';
    default:
      return 'NO_VALID_LAYOUT';
  }
}

function panelizationWarningsToWallLayoutWarnings(
  wallId: string,
  ws: PanelizationWarning[]
): WallPanelLayoutWarning[] {
  return ws
    .filter((w) => w.relatedObjectIds.includes(wallId))
    .map((w) => ({
      code: mapEngineCodeToLayoutCode(w.code),
      message: w.message,
      severity: w.severity,
    }));
}

function generatedPanelsToSegments(panels: GeneratedPanel[], direction: PanelDirection): WallPanelLayoutSegment[] {
  return panels.map((p, idx) => {
    const alongStart = direction === 'vertical' ? p.originXmm : p.originXmm;
    const alongEnd = direction === 'vertical' ? p.originXmm + p.widthMm : p.originXmm + p.widthMm;
    const lengthAlongWallMm = direction === 'vertical' ? p.widthMm : p.widthMm;
    const openingAffected =
      p.zoneType !== undefined && p.zoneType !== 'main' && p.zoneType !== 'slab' && p.zoneType !== 'roof_slope_a' && p.zoneType !== 'roof_slope_b';
    return {
      id: p.id,
      index: idx + 1,
      lengthAlongWallMm,
      heightMm: p.heightMm,
      startOffsetMm: alongStart,
      endOffsetMm: alongEnd,
      verticalOffsetMm: p.originYmm,
      trimmed: p.trimmed,
      openingAffected,
    };
  });
}

function buildSummary(
  wallLengthMm: number,
  direction: PanelDirection,
  panelType: PanelType,
  segments: WallPanelLayoutSegment[],
  openingsCount: number,
  layoutStatus: 'ok' | 'partial' | 'failed'
): WallPanelLayoutSummary {
  const nominalModuleMm = direction === 'vertical' ? panelType.widthMm : panelType.heightMm;
  const trimPanelCount = segments.filter((s) => s.trimmed).length;
  const last = segments.length > 0 ? segments[segments.length - 1]! : null;
  const remainderMm = last?.trimmed ? last.lengthAlongWallMm : 0;
  const totalAlong = segments.reduce((s, p) => s + p.lengthAlongWallMm, 0);
  const ideal = Math.ceil(wallLengthMm / nominalModuleMm) * nominalModuleMm;
  const utilizationRatio = ideal > 0 ? Math.min(1, totalAlong / ideal) : 0;
  const mainPanels = segments.filter((s) => !s.openingAffected).length;
  const fullLayoutFraction = segments.length > 0 ? mainPanels / segments.length : 0;
  let panelizationStatus: WallPanelizationUiStatus;
  if (layoutStatus === 'failed') {
    panelizationStatus = 'invalid';
  } else if (layoutStatus === 'partial' || openingsCount > 0) {
    panelizationStatus = 'partial';
  } else {
    panelizationStatus = 'ready';
  }
  return {
    wallLengthMm,
    nominalModuleMm,
    panelCount: segments.length,
    trimPanelCount,
    remainderMm,
    utilizationRatio,
    openingsCount,
    fullLayoutFraction,
    panelizationStatus,
  };
}

/** Швы вдоль длины в «глухой» нижней зоне, попадающие строго внутрь проёма по оси стены. */
function checkMainRowSeamsInsideOpeningSpans(
  panels: GeneratedPanel[],
  openings: Opening[],
  wallLengthMm: number,
  wallHeightMm: number,
  direction: PanelDirection
): PanelizationWarning[] {
  const out: PanelizationWarning[] = [];
  if (direction !== 'vertical' || openings.length === 0) return out;
  const mains = panels.filter(
    (p) =>
      p.zoneType === 'main' &&
      p.originYmm < 2 &&
      Math.abs(p.heightMm - wallHeightMm) < 3
  );
  const boundaries = new Set<number>();
  for (const p of mains) {
    boundaries.add(Math.round(p.originXmm));
    boundaries.add(Math.round(p.originXmm + p.widthMm));
  }
  for (const opening of openings) {
    const left = Math.max(0, opening.positionAlongWall - opening.widthMm / 2);
    const right = Math.min(wallLengthMm, opening.positionAlongWall + opening.widthMm / 2);
    for (const t of boundaries) {
      if (t <= 0 || t >= wallLengthMm) continue;
      if (t > left && t < right) {
        out.push(
          makeWarning(
            'OPENING_INTERSECTS_PANEL_BOUNDARY',
            'warning',
            `Шов на ${t} мм попадает внутрь проёма ${opening.id} (глухой ряд; упрощённая проверка).`,
            [opening.wallId, opening.id]
          )
        );
      }
    }
  }
  return out;
}

export interface ProcessWallForPanelizationResult {
  generatedPanels: GeneratedPanel[];
  warnings: PanelizationWarning[];
  wallSummary: WallPanelizationSummary;
  layoutResult: WallPanelLayoutResult;
}

export function processWallForPanelization(
  model: BuildingModel,
  wall: Wall,
  wallIndexInFloor: number,
  floorLevel: number
): ProcessWallForPanelizationResult {
  const wallWarnings: PanelizationWarning[] = [];
  const eligibility = isWallEligibleForPanelization(wall);
  const direction = resolvePanelDirection(wall);

  const emptyLayout = (partial: Partial<WallPanelLayoutResult>): WallPanelLayoutResult => ({
    wallId: wall.id,
    floorId: wall.floorId,
    panelTypeId: partial.panelTypeId ?? '',
    direction: partial.direction ?? 'vertical',
    computedAt: new Date().toISOString(),
    panels: partial.panels ?? [],
    warnings: partial.warnings ?? [],
    summary:
      partial.summary ??
      ({
        wallLengthMm: computeWallLengthMm(wall),
        nominalModuleMm: 0,
        panelCount: 0,
        trimPanelCount: 0,
        remainderMm: 0,
        utilizationRatio: 0,
        openingsCount: 0,
        fullLayoutFraction: 0,
        panelizationStatus: 'invalid',
      } satisfies WallPanelLayoutSummary),
    status: partial.status ?? 'failed',
  });

  if (!eligibility.eligible) {
    if (eligibility.reason === 'disabled') {
      wallWarnings.push(
        makeWarning('PANELIZATION_DISABLED', 'info', `Панелизация стены ${wall.id} отключена`, [wall.id])
      );
    } else if (wall.wallType === 'internal') {
      wallWarnings.push(
        makeWarning(
          'INTERNAL_WALL_SKIPPED',
          'info',
          `Внутренняя стена ${wall.id} пропущена (не несущая или отключена)`,
          [wall.id]
        )
      );
    }
    wallWarnings.push(
      makeWarning('WALL_NOT_PANELIZABLE', 'warning', `Стена ${wall.id} не подходит для панелизации`, [wall.id])
    );
    const lr = emptyLayout({
      warnings: panelizationWarningsToWallLayoutWarnings(wall.id, wallWarnings),
      status: 'failed',
      panelTypeId: wall.panelTypeId ?? model.panelSettings.defaultPanelTypeId ?? '',
      direction: wall.panelDirection ?? 'vertical',
    });
    return {
      generatedPanels: [],
      warnings: wallWarnings,
      wallSummary: {
        wallId: wall.id,
        floorId: wall.floorId,
        eligible: false,
        reason: eligibility.reason,
        direction,
        effectivePanelTypeId: null,
        panelCount: 0,
        warningCount: wallWarnings.length,
      },
      layoutResult: lr,
    };
  }

  const panelType = resolveEffectivePanelType(model, wall);
  if (!panelType) {
    wallWarnings.push(
      makeWarning('PANEL_TYPE_NOT_SET', 'error', `Для стены ${wall.id} не найден effective panel type`, [
        wall.id,
      ])
    );
    const lr = emptyLayout({
      warnings: panelizationWarningsToWallLayoutWarnings(wall.id, wallWarnings),
      status: 'failed',
      direction: direction ?? 'vertical',
    });
    return {
      generatedPanels: [],
      warnings: wallWarnings,
      wallSummary: {
        wallId: wall.id,
        floorId: wall.floorId,
        eligible: true,
        direction,
        effectivePanelTypeId: null,
        panelCount: 0,
        warningCount: wallWarnings.length,
      },
      layoutResult: lr,
    };
  }

  if (!direction) {
    wallWarnings.push(
      makeWarning(
        'PANEL_DIRECTION_MISSING',
        'warning',
        `Для стены ${wall.id} не задано направление панелизации`,
        [wall.id]
      )
    );
    const lr = emptyLayout({
      panelTypeId: panelType.id,
      warnings: panelizationWarningsToWallLayoutWarnings(wall.id, wallWarnings),
      status: 'failed',
    });
    return {
      generatedPanels: [],
      warnings: wallWarnings,
      wallSummary: {
        wallId: wall.id,
        floorId: wall.floorId,
        eligible: true,
        direction: null,
        effectivePanelTypeId: panelType.id,
        panelCount: 0,
        warningCount: wallWarnings.length,
      },
      layoutResult: lr,
    };
  }

  if (direction === 'horizontal') {
    wallWarnings.push(
      makeWarning(
        'PANEL_LAYOUT_PARTIAL',
        'warning',
        'Горизонтальная нарезка: упрощённые ряды по высоте зоны; детальная заводская логика может отличаться.',
        [wall.id]
      )
    );
  }

  const floorEntity = getFloorById(model, wall.floorId);
  const wallHeight = getEffectiveWallHeight(wall, floorEntity);
  const wallLength = computeWallLengthMm(wall);
  const wallOpenings = getOpeningsByWall(model, wall.id).sort(
    (a, b) => a.positionAlongWall - b.positionAlongWall
  );

  const nOpen = wallOpenings.length;
  if (nOpen > 0) {
    wallWarnings.push(
      makeWarning('WALL_HAS_OPENINGS', 'info', `На стене ${wall.id} учтено проёмов: ${nOpen}.`, [wall.id])
    );
    wallWarnings.push(
      makeWarning(
        'OPENING_LAYOUT_PARTIAL',
        'warning',
        'Раскладка с проёмами — черновая: зоны над/под проёмом без заводской деталировки перемычек и доборов.',
        [wall.id]
      )
    );
    wallWarnings.push(
      makeWarning(
        'PANEL_LAYOUT_PARTIAL',
        'info',
        'Итоговая панелизация стены с проёмами неполная относительно полной глухой стены (черновой BOM).',
        [wall.id]
      )
    );
  }
  if (nOpen > 1) {
    wallWarnings.push(
      makeWarning(
        'MULTIPLE_OPENINGS_COMPLEX_LAYOUT',
        'warning',
        'Несколько проёмов на одной стене — повышенная сложность; проверьте раскладку вручную.',
        [wall.id]
      )
    );
  }

  for (const opening of wallOpenings) {
    const left = opening.positionAlongWall - opening.widthMm / 2;
    const right = opening.positionAlongWall + opening.widthMm / 2;
    if (left < model.panelSettings.minTrimWidthMm) {
      wallWarnings.push(
        makeWarning(
          'OPENING_TOO_CLOSE_TO_EDGE',
          'warning',
          `Проём ${opening.id} близко к началу стены (край).`,
          [wall.id, opening.id]
        )
      );
    }
    if (wallLength - right < model.panelSettings.minTrimWidthMm) {
      wallWarnings.push(
        makeWarning(
          'OPENING_TOO_CLOSE_TO_EDGE',
          'warning',
          `Проём ${opening.id} близко к концу стены (край).`,
          [wall.id, opening.id]
        )
      );
    }
    if (opening.bottomOffsetMm + opening.heightMm >= wallHeight - 30) {
      wallWarnings.push(
        makeWarning(
          'OPENING_NOT_SUPPORTED_FOR_FULL_LAYOUT',
          'info',
          `Проём ${opening.id} почти на всю высоту — непрерывная «глухая» панелизация недоступна.`,
          [wall.id, opening.id]
        )
      );
    }
  }

  const zones = buildZones(wallLength, wallHeight, wallOpenings);
  const baseSegments = splitByOpenings(wallLength, wallOpenings);
  const splitApplied =
    nOpen > 0 && (baseSegments.length > 1 || zones.some((z) => z.zoneType !== 'main'));
  if (splitApplied) {
    wallWarnings.push(
      makeWarning(
        'OPENING_SPLIT_APPLIED',
        'info',
        'Стена разбита на зоны вдоль длины с учётом проёмов (глухие участки / над проёмом / под окном).',
        [wall.id]
      )
    );
  }
  let panelCounter = 0;
  const generatedPanels: GeneratedPanel[] = [];
  for (const zone of zones) {
    const built = buildPanelsForZone(
      zone,
      wall,
      floorLevel,
      wallIndexInFloor + 1,
      direction,
      panelType,
      model,
      panelCounter
    );
    panelCounter += built.panels.length;
    generatedPanels.push(...built.panels);
    wallWarnings.push(...built.warnings);
  }

  wallWarnings.push(
    ...checkMainRowSeamsInsideOpeningSpans(
      generatedPanels,
      wallOpenings,
      wallLength,
      wallHeight,
      direction
    )
  );

  const segments = generatedPanelsToSegments(generatedPanels, direction);
  const layoutWarnings = panelizationWarningsToWallLayoutWarnings(wall.id, wallWarnings);
  const hasError = wallWarnings.some((w) => w.severity === 'error');
  const status: WallPanelLayoutResult['status'] = hasError
    ? 'failed'
    : segments.length === 0
      ? 'failed'
      : wallWarnings.some((w) => w.severity === 'warning') ||
          layoutWarnings.some((w) => w.severity === 'warning')
        ? 'partial'
        : 'ok';

  const summary = buildSummary(
    wallLength,
    direction,
    panelType,
    segments,
    nOpen,
    status
  );

  const layoutResult: WallPanelLayoutResult = {
    wallId: wall.id,
    floorId: wall.floorId,
    panelTypeId: panelType.id,
    direction,
    computedAt: new Date().toISOString(),
    panels: segments,
    warnings: layoutWarnings,
    summary,
    status,
    geometrySignature: computeWallPanelizationGeometrySignature(model, wall.id),
    stale: false,
  };

  return {
    generatedPanels,
    warnings: wallWarnings,
    wallSummary: {
      wallId: wall.id,
      floorId: wall.floorId,
      eligible: true,
      direction,
      effectivePanelTypeId: panelType.id,
      panelCount: generatedPanels.length,
      warningCount: wallWarnings.length,
    },
    layoutResult,
  };
}

export interface BatchWallPanelLayoutFloorSummary {
  eligibleWalls: number;
  layoutOk: number;
  layoutPartial: number;
  layoutFailed: number;
}

/**
 * Расчёт раскладок для всех eligible стен этажа (не мутирует model).
 */
export function batchComputeWallPanelLayoutsForFloor(
  model: BuildingModel,
  floorId: string
): { layouts: Record<string, WallPanelLayoutResult>; summary: BatchWallPanelLayoutFloorSummary } {
  const floor = getFloorById(model, floorId);
  if (!floor) {
    return {
      layouts: {},
      summary: { eligibleWalls: 0, layoutOk: 0, layoutPartial: 0, layoutFailed: 0 },
    };
  }
  const floorWalls = getWallsByFloor(model, floorId);
  const layouts: Record<string, WallPanelLayoutResult> = {};
  let eligibleWalls = 0;
  let layoutOk = 0;
  let layoutPartial = 0;
  let layoutFailed = 0;
  for (let i = 0; i < floorWalls.length; i += 1) {
    const wall = floorWalls[i]!;
    const el = isWallEligibleForPanelization(wall);
    if (!el.eligible) continue;
    eligibleWalls += 1;
    const r = processWallForPanelization(model, wall, i, floor.level);
    layouts[wall.id] = r.layoutResult;
    if (r.layoutResult.status === 'ok') layoutOk += 1;
    else if (r.layoutResult.status === 'partial') layoutPartial += 1;
    else layoutFailed += 1;
  }
  return {
    layouts,
    summary: { eligibleWalls, layoutOk, layoutPartial, layoutFailed },
  };
}

export function computeWallPanelLayoutForWall(
  model: BuildingModel,
  wallId: string
): ProcessWallForPanelizationResult | null {
  const wall = getWallById(model, wallId);
  if (!wall) return null;
  const floor = getFloorById(model, wall.floorId);
  if (!floor) return null;
  const floorWalls = getWallsByFloor(model, wall.floorId);
  const wallIndexInFloor = floorWalls.findIndex((w) => w.id === wallId);
  if (wallIndexInFloor < 0) return null;
  return processWallForPanelization(model, wall, wallIndexInFloor, floor.level);
}

export function wallLayoutResultToGeneratedPanels(
  layout: WallPanelLayoutResult,
  wall: Wall,
  floorLevel: number,
  wallIndex: number,
  model: BuildingModel
): GeneratedPanel[] {
  return layout.panels.map((seg) => {
    const panelIndex = seg.index;
    const label = `${model.panelSettings.labelPrefixWall || 'W'}-${floorLevel}-${wallIndex}-${panelIndex}`;
    const orientation = layout.direction;
    const widthMm =
      orientation === 'vertical' ? seg.lengthAlongWallMm : seg.endOffsetMm - seg.startOffsetMm;
    const heightMm = seg.heightMm;
    const originXmm = seg.startOffsetMm;
    const originYmm = seg.verticalOffsetMm;
    return {
      id: seg.id,
      sourceType: 'wall' as const,
      sourceId: wall.id,
      floorId: wall.floorId,
      panelTypeId: layout.panelTypeId,
      orientation,
      originXmm,
      originYmm,
      widthMm,
      heightMm,
      trimmed: seg.trimmed,
      label,
      zoneType: seg.openingAffected ? ('above_opening' as const) : ('main' as const),
    };
  });
}
