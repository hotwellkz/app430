import {
  getRoofForTopFloor,
  getSlabsByFloor,
  getWallsByFloor,
  getWallById,
  getTopFloor,
} from '@2wix/domain-model';
import type { BuildingModel, PanelType, Roof, Slab, Wall } from '@2wix/shared-types';
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
import { processWallForPanelization } from './wallPanelLayoutProcess.js';

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

function resolvePanelTypeById(model: BuildingModel, id: string | null | undefined): PanelType | null {
  if (!id) return null;
  const found = model.panelLibrary.find((p) => p.id === id && p.active);
  return found ?? null;
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
      const r = processWallForPanelization(model, wall, i, floor.level);
      warnings.push(...r.warnings);
      generatedPanels.push(...r.generatedPanels);
      wallSummaries.push({
        ...r.wallSummary,
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
