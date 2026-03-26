import {
  computeWallLengthMm,
  getEffectiveWallHeight,
  getFloorById,
  getOpeningsByWall,
  getRoofForTopFloor,
  getSlabsByFloor,
  getWallsByFloor,
  getWallById,
  getTopFloor,
} from '@2wix/domain-model';
import type { BuildingModel, Opening, PanelDirection, PanelType, Roof, Slab, Wall } from '@2wix/shared-types';
import type {
  BuildPanelizationOptions,
  GeneratedPanel,
  PanelizationResult,
  PanelizationWarning,
  PanelizationWarningCode,
  RoofPanelizationSummary,
  SlabPanelizationSummary,
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

function resolveEffectivePanelTypeForSlab(model: BuildingModel, slab: Slab): PanelType | null {
  const local = resolvePanelTypeById(model, slab.panelTypeId);
  if (local) return local;
  return resolvePanelTypeById(model, model.panelSettings.defaultPanelTypeId);
}

function resolveEffectivePanelTypeForRoof(model: BuildingModel, roof: Roof): PanelType | null {
  const local = resolvePanelTypeById(model, roof.panelTypeId);
  if (local) return local;
  return resolvePanelTypeById(model, model.panelSettings.defaultPanelTypeId);
}

function buildBoundingBoxFromWalls(model: BuildingModel, wallIds: string[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const walls = wallIds
    .map((id) => getWallById(model, id))
    .filter((w): w is Wall => Boolean(w));
  if (walls.length === 0) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const w of walls) {
    xs.push(w.start.x, w.end.x);
    ys.push(w.start.y, w.end.y);
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function areaM2(widthMm: number, heightMm: number): number {
  return (widthMm * heightMm) / 1_000_000;
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
  const slabSummaries: SlabPanelizationSummary[] = [];
  const roofSummaries: RoofPanelizationSummary[] = [];
  const generatedPanels: GeneratedPanel[] = [];

  const defaultPanelType = resolvePanelTypeById(model, model.panelSettings.defaultPanelTypeId);
  if (!defaultPanelType) {
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
          effectivePanelTypeId: null,
          panelCount: 0,
          warningCount: warnings.length - wallWarningsStart,
        });
        continue;
      }
      const panelType = resolveEffectivePanelType(model, wall);
      if (!panelType) {
        warnings.push(
          makeWarning(
            'PANEL_TYPE_NOT_SET',
            'error',
            `Для стены ${wall.id} не найден effective panel type`,
            [wall.id]
          )
        );
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
          effectivePanelTypeId: panelType?.id ?? null,
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
          effectivePanelTypeId: null,
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
        effectivePanelTypeId: panelType.id,
        panelCount: generatedPanels.length - beforePanels,
        warningCount: warnings.length - wallWarningsStart,
      });
    }
  }

  for (const floor of model.floors) {
    const slabs = getSlabsByFloor(model, floor.id);
    for (let i = 0; i < slabs.length; i += 1) {
      const slab = slabs[i]!;
      const warningsStart = warnings.length;
      const dir = slab.direction === 'x' || slab.direction === 'y' ? slab.direction : null;
      const enabled = slab.panelizationEnabled ?? true;
      const panelType = resolveEffectivePanelTypeForSlab(model, slab);
      if (!enabled) {
        warnings.push(makeWarning('SLAB_NOT_PANELIZABLE', 'info', `Панелизация перекрытия ${slab.id} отключена`, [slab.id]));
        slabSummaries.push({
          slabId: slab.id,
          floorId: slab.floorId,
          eligible: false,
          reason: 'disabled',
          direction: dir,
          effectivePanelTypeId: panelType?.id ?? null,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
        continue;
      }
      if (!dir) {
        warnings.push(makeWarning('SLAB_DIRECTION_MISSING', 'warning', `Для перекрытия ${slab.id} не задано направление`, [slab.id]));
        slabSummaries.push({
          slabId: slab.id,
          floorId: slab.floorId,
          eligible: true,
          reason: 'direction_missing',
          direction: null,
          effectivePanelTypeId: panelType?.id ?? null,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
        continue;
      }
      if (!panelType) {
        warnings.push(makeWarning('PANEL_TYPE_NOT_SET', 'error', `Для перекрытия ${slab.id} не найден effective panel type`, [slab.id]));
        slabSummaries.push({
          slabId: slab.id,
          floorId: slab.floorId,
          eligible: true,
          reason: 'panel_type_missing',
          direction: dir,
          effectivePanelTypeId: null,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
        continue;
      }
      const bb = buildBoundingBoxFromWalls(model, slab.contourWallIds);
      if (!bb) {
        warnings.push(makeWarning('SLAB_NOT_PANELIZABLE', 'warning', `Не найден валидный контур стен для перекрытия ${slab.id}`, [slab.id]));
        slabSummaries.push({
          slabId: slab.id,
          floorId: slab.floorId,
          eligible: false,
          reason: 'no_contour',
          direction: dir,
          effectivePanelTypeId: panelType.id,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
        continue;
      }
      const slabWidth = bb.maxX - bb.minX;
      const slabHeight = bb.maxY - bb.minY;
      const splitSize = dir === 'x' ? panelType.widthMm : panelType.heightMm;
      const axisLen = dir === 'x' ? slabWidth : slabHeight;
      if (axisLen < splitSize) {
        warnings.push(makeWarning('SLAB_TOO_SMALL', 'warning', `Перекрытие ${slab.id} слишком маленькое для раскладки`, [slab.id]));
      }
      const unitCount = Math.floor(axisLen / splitSize);
      const remainder = axisLen - unitCount * splitSize;
      const allowTrim = model.panelSettings.allowTrimmedPanels;
      const minTrim = model.panelSettings.minTrimWidthMm;
      if (remainder > 0 && (!allowTrim || remainder < minTrim)) {
        warnings.push(makeWarning('NO_VALID_SLAB_LAYOUT', 'error', `Нет валидной раскладки для перекрытия ${slab.id}`, [slab.id]));
        slabSummaries.push({
          slabId: slab.id,
          floorId: slab.floorId,
          eligible: true,
          reason: 'no_valid_layout',
          direction: dir,
          effectivePanelTypeId: panelType.id,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
        continue;
      }
      const total = unitCount + (remainder > 0 ? 1 : 0);
      const beforePanels = generatedPanels.length;
      let trimmedCount = 0;
      let totalArea = 0;
      for (let p = 0; p < total; p += 1) {
        const trimmed = remainder > 0 && p === total - 1;
        const size = trimmed ? remainder : splitSize;
        if (size <= 0) continue;
        if (trimmed) trimmedCount += 1;
        const widthMm = dir === 'x' ? size : slabWidth;
        const heightMm = dir === 'x' ? slabHeight : size;
        const originXmm = dir === 'x' ? bb.minX + p * splitSize : bb.minX;
        const originYmm = dir === 'x' ? bb.minY : bb.minY + p * splitSize;
        totalArea += areaM2(widthMm, heightMm);
        const label = `${model.panelSettings.labelPrefixSlab || 'S'}-${floor.level}-${i + 1}-${p + 1}`;
        generatedPanels.push({
          id: `${slab.id}-${label}`,
          sourceType: 'slab',
          sourceId: slab.id,
          floorId: slab.floorId,
          panelTypeId: panelType.id,
          orientation: dir === 'x' ? 'vertical' : 'horizontal',
          originXmm,
          originYmm,
          widthMm,
          heightMm,
          trimmed,
          label,
          zoneType: 'slab',
        });
      }
      slabSummaries.push({
        slabId: slab.id,
        floorId: slab.floorId,
        eligible: true,
        direction: dir,
        effectivePanelTypeId: panelType.id,
        panelCount: generatedPanels.length - beforePanels,
        trimmedCount,
        totalAreaM2: Math.round(totalArea * 100) / 100,
        warningCount: warnings.length - warningsStart,
      });
    }
  }

  const topFloor = getTopFloor(model);
  const roof = getRoofForTopFloor(model);
  if (roof && topFloor) {
    const warningsStart = warnings.length;
    const enabled = roof.panelizationEnabled ?? true;
    const panelType = resolveEffectivePanelTypeForRoof(model, roof);
    if (!enabled) {
      warnings.push(makeWarning('ROOF_NOT_PANELIZABLE', 'info', `Панелизация крыши ${roof.id} отключена`, [roof.id]));
      roofSummaries.push({
        roofId: roof.id,
        floorId: roof.floorId,
        eligible: false,
        reason: 'disabled',
        roofType: roof.roofType,
        slopeSections: 0,
        effectivePanelTypeId: panelType?.id ?? null,
        panelCount: 0,
        trimmedCount: 0,
        totalAreaM2: 0,
        warningCount: warnings.length - warningsStart,
      });
    } else if (roof.roofType !== 'single_slope' && roof.roofType !== 'gable') {
      warnings.push(makeWarning('ROOF_TYPE_NOT_SUPPORTED', 'warning', `Тип крыши ${roof.roofType} не поддержан`, [roof.id]));
      roofSummaries.push({
        roofId: roof.id,
        floorId: roof.floorId,
        eligible: false,
        reason: 'type_unsupported',
        roofType: null,
        slopeSections: 0,
        effectivePanelTypeId: panelType?.id ?? null,
        panelCount: 0,
        trimmedCount: 0,
        totalAreaM2: 0,
        warningCount: warnings.length - warningsStart,
      });
    } else if (roof.slopeDegrees <= 0 || roof.slopeDegrees > 75) {
      warnings.push(makeWarning('ROOF_SLOPE_INVALID', 'warning', `Некорректный уклон крыши ${roof.id}`, [roof.id]));
    } else if (!panelType) {
      warnings.push(makeWarning('PANEL_TYPE_NOT_SET', 'error', `Для крыши ${roof.id} не найден effective panel type`, [roof.id]));
    } else {
      const floorWalls = getWallsByFloor(model, topFloor.id);
      const bb = buildBoundingBoxFromWalls(model, floorWalls.map((w) => w.id));
      if (!bb) {
        warnings.push(makeWarning('ROOF_GEOMETRY_INCOMPLETE', 'warning', `Недостаточно геометрии для крыши ${roof.id}`, [roof.id]));
        roofSummaries.push({
          roofId: roof.id,
          floorId: roof.floorId,
          eligible: false,
          reason: 'geometry_incomplete',
          roofType: roof.roofType,
          slopeSections: 0,
          effectivePanelTypeId: panelType.id,
          panelCount: 0,
          trimmedCount: 0,
          totalAreaM2: 0,
          warningCount: warnings.length - warningsStart,
        });
      } else {
        const footprintW = bb.maxX - bb.minX + roof.overhangMm * 2;
        const footprintH = bb.maxY - bb.minY + roof.overhangMm * 2;
        const sections = roof.roofType === 'gable' ? 2 : 1;
        const sectionWidth = roof.roofType === 'gable' ? footprintW / 2 : footprintW;
        const splitSize = panelType.widthMm;
        const unitCount = Math.floor(sectionWidth / splitSize);
        const remainder = sectionWidth - unitCount * splitSize;
        const allowTrim = model.panelSettings.allowTrimmedPanels;
        const minTrim = model.panelSettings.minTrimWidthMm;
        if (remainder > 0 && (!allowTrim || remainder < minTrim)) {
          warnings.push(makeWarning('NO_VALID_ROOF_LAYOUT', 'error', `Нет валидной раскладки для крыши ${roof.id}`, [roof.id]));
          roofSummaries.push({
            roofId: roof.id,
            floorId: roof.floorId,
            eligible: true,
            reason: 'no_valid_layout',
            roofType: roof.roofType,
            slopeSections: sections,
            effectivePanelTypeId: panelType.id,
            panelCount: 0,
            trimmedCount: 0,
            totalAreaM2: 0,
            warningCount: warnings.length - warningsStart,
          });
        } else {
          const beforePanels = generatedPanels.length;
          let trimmedCount = 0;
          let totalArea = 0;
          for (let s = 0; s < sections; s += 1) {
            const total = unitCount + (remainder > 0 ? 1 : 0);
            for (let p = 0; p < total; p += 1) {
              const trimmed = remainder > 0 && p === total - 1;
              const size = trimmed ? remainder : splitSize;
              if (size <= 0) continue;
              if (trimmed) trimmedCount += 1;
              const ox = bb.minX - roof.overhangMm + s * sectionWidth + p * splitSize;
              const oy = bb.minY - roof.overhangMm;
              const widthMm = size;
              const heightMm = footprintH;
              totalArea += areaM2(widthMm, heightMm);
              const label = `${model.panelSettings.labelPrefixRoof || 'R'}-${topFloor.level}-${s + 1}-${p + 1}`;
              generatedPanels.push({
                id: `${roof.id}-${label}`,
                sourceType: 'roof',
                sourceId: roof.id,
                floorId: roof.floorId,
                panelTypeId: panelType.id,
                orientation: 'vertical',
                originXmm: ox,
                originYmm: oy,
                widthMm,
                heightMm,
                trimmed,
                label,
                zoneType: s === 0 ? 'roof_slope_a' : 'roof_slope_b',
              });
            }
          }
          roofSummaries.push({
            roofId: roof.id,
            floorId: roof.floorId,
            eligible: true,
            roofType: roof.roofType,
            slopeSections: sections,
            effectivePanelTypeId: panelType.id,
            panelCount: generatedPanels.length - beforePanels,
            trimmedCount,
            totalAreaM2: Math.round(totalArea * 100) / 100,
            warningCount: warnings.length - warningsStart,
          });
        }
      }
    }
  }

  const panelizedWalls = wallSummaries.filter((w) => w.panelCount > 0).length;
  const panelizedSlabs = slabSummaries.filter((s) => s.panelCount > 0).length;
  const panelizedRoofs = roofSummaries.filter((r) => r.panelCount > 0).length;
  const wallPanels = generatedPanels.filter((p) => p.sourceType === 'wall').length;
  const slabPanels = generatedPanels.filter((p) => p.sourceType === 'slab').length;
  const roofPanels = generatedPanels.filter((p) => p.sourceType === 'roof').length;
  const trimmedPanels = generatedPanels.filter((p) => p.trimmed).length;
  return {
    generatedPanels,
    warnings,
    stats: {
      eligibleWalls: wallSummaries.filter((w) => w.eligible).length,
      panelizedWalls,
      eligibleSlabs: slabSummaries.filter((s) => s.eligible).length,
      panelizedSlabs,
      eligibleRoofs: roofSummaries.filter((r) => r.eligible).length,
      panelizedRoofs,
      wallPanels,
      slabPanels,
      roofPanels,
      trimmedPanels,
      generatedPanels: generatedPanels.length,
      warnings: warnings.filter((w) => w.severity === 'warning').length,
      errors: warnings.filter((w) => w.severity === 'error').length,
    },
    wallSummaries,
    slabSummaries,
    roofSummaries,
  };
}
