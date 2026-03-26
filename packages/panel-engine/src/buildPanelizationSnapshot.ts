import {
  computeWallLengthMm,
  getEffectiveWallHeight,
  getFloorById,
  getOpeningsByWall,
  getWallsByFloor,
} from '@2wix/domain-model';
import type { BuildingModel, Opening, PanelDirection, PanelType, Wall } from '@2wix/shared-types';
import type {
  BuildPanelizationOptions,
  GeneratedPanel,
  PanelizationResult,
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
    id: `${code}-${relatedObjectIds.join('-')}-${message}`,
    code,
    severity,
    message,
    relatedObjectIds,
  };
}

function isWallEligible(wall: Wall): { eligible: boolean; reason?: string } {
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

function resolvePanelType(model: BuildingModel): PanelType | null {
  const id = model.panelSettings.defaultPanelTypeId;
  if (!id) return null;
  const found = model.panelLibrary.find((p) => p.id === id && p.active);
  return found ?? null;
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
        'WALL_TOO_SHORT_FOR_LAYOUT',
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

export function buildPanelizationSnapshot(
  model: BuildingModel,
  _options: BuildPanelizationOptions = {}
): PanelizationResult {
  const warnings: PanelizationWarning[] = [];
  const wallSummaries: WallPanelizationSummary[] = [];
  const generatedPanels: GeneratedPanel[] = [];

  if (model.roofs.length > 0) {
    warnings.push(
      makeWarning('ROOF_NOT_SUPPORTED_YET', 'info', 'Панелизация кровли будет добавлена позже', [])
    );
  }
  if (model.slabs.length > 0) {
    warnings.push(
      makeWarning('SLAB_NOT_SUPPORTED_YET', 'info', 'Панелизация плит будет добавлена позже', [])
    );
  }

  const panelType = resolvePanelType(model);
  if (!panelType) {
    warnings.push(
      makeWarning('PANEL_TYPE_NOT_SET', 'error', 'Не задан defaultPanelTypeId или тип панели неактивен', [])
    );
  }

  for (const floor of model.floors) {
    const floorWalls = getWallsByFloor(model, floor.id);
    for (let i = 0; i < floorWalls.length; i += 1) {
      const wall = floorWalls[i]!;
      const wallWarningsStart = warnings.length;
      const eligibility = isWallEligible(wall);
      const direction = resolvePanelDirection(wall);
      if (!eligibility.eligible) {
        if (eligibility.reason === 'disabled') {
          warnings.push(
            makeWarning('PANELIZATION_DISABLED', 'info', `Панелизация стены ${wall.id} отключена`, [
              wall.id,
            ])
          );
        } else if (wall.wallType === 'internal') {
          warnings.push(
            makeWarning(
              'INTERNAL_WALL_SKIPPED',
              'info',
              `Внутренняя стена ${wall.id} пропущена (не несущая или отключена)`,
              [wall.id]
            )
          );
        }
        wallSummaries.push({
          wallId: wall.id,
          floorId: wall.floorId,
          eligible: false,
          reason: eligibility.reason,
          direction,
          panelCount: 0,
          warningCount: warnings.length - wallWarningsStart,
        });
        continue;
      }
      if (!direction) {
        warnings.push(
          makeWarning(
            'PANEL_DIRECTION_MISSING',
            'warning',
            `Для стены ${wall.id} не задано направление панелизации`,
            [wall.id]
          )
        );
        wallSummaries.push({
          wallId: wall.id,
          floorId: wall.floorId,
          eligible: true,
          direction: null,
          panelCount: 0,
          warningCount: warnings.length - wallWarningsStart,
        });
        continue;
      }
      if (!panelType) {
        wallSummaries.push({
          wallId: wall.id,
          floorId: wall.floorId,
          eligible: true,
          direction,
          panelCount: 0,
          warningCount: warnings.length - wallWarningsStart,
        });
        continue;
      }
      const floorEntity = getFloorById(model, wall.floorId);
      const wallHeight = getEffectiveWallHeight(wall, floorEntity);
      const wallLength = computeWallLengthMm(wall);
      const wallOpenings = getOpeningsByWall(model, wall.id).sort(
        (a, b) => a.positionAlongWall - b.positionAlongWall
      );
      for (const opening of wallOpenings) {
        const left = opening.positionAlongWall - opening.widthMm / 2;
        const right = opening.positionAlongWall + opening.widthMm / 2;
        if (left < model.panelSettings.minTrimWidthMm) {
          warnings.push(
            makeWarning(
              'OPENING_TOO_CLOSE_TO_WALL_START',
              'warning',
              `Проем ${opening.id} слишком близко к началу стены`,
              [wall.id, opening.id]
            )
          );
        }
        if (wallLength - right < model.panelSettings.minTrimWidthMm) {
          warnings.push(
            makeWarning(
              'OPENING_TOO_CLOSE_TO_WALL_END',
              'warning',
              `Проем ${opening.id} слишком близко к концу стены`,
              [wall.id, opening.id]
            )
          );
        }
      }
      const zones = buildZones(wallLength, wallHeight, wallOpenings);
      let panelCounter = 0;
      const beforePanels = generatedPanels.length;
      for (const zone of zones) {
        const built = buildPanelsForZone(
          zone,
          wall,
          floor.level,
          i + 1,
          direction,
          panelType,
          model,
          panelCounter
        );
        panelCounter += built.panels.length;
        generatedPanels.push(...built.panels);
        warnings.push(...built.warnings);
      }
      wallSummaries.push({
        wallId: wall.id,
        floorId: wall.floorId,
        eligible: true,
        direction,
        panelCount: generatedPanels.length - beforePanels,
        warningCount: warnings.length - wallWarningsStart,
      });
    }
  }

  const panelizedWalls = wallSummaries.filter((w) => w.panelCount > 0).length;
  return {
    generatedPanels,
    warnings,
    stats: {
      eligibleWalls: wallSummaries.filter((w) => w.eligible).length,
      panelizedWalls,
      generatedPanels: generatedPanels.length,
      warnings: warnings.filter((w) => w.severity === 'warning').length,
      errors: warnings.filter((w) => w.severity === 'error').length,
    },
    wallSummaries,
  };
}
