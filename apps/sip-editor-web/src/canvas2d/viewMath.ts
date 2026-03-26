import type { Point2D } from '@2wix/shared-types';
import { clampEditorZoom } from '@2wix/editor-core';

export type ScreenPoint = { x: number; y: number };

/** Мир в мм → экран в px (origin SVG слева сверху, ось Y вниз). */
export function worldToScreen(
  wx: number,
  wy: number,
  panX: number,
  panY: number,
  zoom: number
): ScreenPoint {
  return {
    x: wx * zoom + panX,
    y: wy * zoom + panY,
  };
}

/** Экран в px → мир в мм. */
export function screenToWorld(
  sx: number,
  sy: number,
  panX: number,
  panY: number,
  zoom: number
): Point2D {
  const z = zoom || 1;
  return {
    x: (sx - panX) / z,
    y: (sy - panY) / z,
  };
}

export function snapScalarToGrid(value: number, stepMm: number): number {
  if (!Number.isFinite(stepMm) || stepMm <= 0) return value;
  return Math.round(value / stepMm) * stepMm;
}

export function snapPointToGrid(
  p: Point2D,
  stepMm: number,
  snapEnabled: boolean
): Point2D {
  if (!snapEnabled) return { x: p.x, y: p.y };
  return {
    x: snapScalarToGrid(p.x, stepMm),
    y: snapScalarToGrid(p.y, stepMm),
  };
}

/** Толеранс hit-test в мм из желаемого размера в пикселях при текущем zoom. */
export function hitToleranceWorldMm(zoom: number, pixels = 12): number {
  const z = zoom || 1;
  return pixels / z;
}

/** Радиус ручки конца стены в мм (не меньше ~12px на экране). */
export function endpointHandleRadiusWorldMm(zoom: number, pixels = 14): number {
  const z = zoom || 1;
  return Math.max(350, pixels / z);
}

/**
 * После изменения zoom сохранить мир под курсором (sx, sy в координатах SVG).
 * Возвращает новые panX, panY.
 */
export function panToKeepWorldUnderScreenPoint(
  sx: number,
  sy: number,
  panX: number,
  panY: number,
  zoomOld: number,
  zoomNew: number
): { panX: number; panY: number } {
  const z0 = zoomOld || 1;
  const z1 = clampEditorZoom(zoomNew);
  const wx = (sx - panX) / z0;
  const wy = (sy - panY) / z0;
  return {
    panX: sx - wx * z1,
    panY: sy - wy * z1,
  };
}

export function clientToSvgPoint(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement
): ScreenPoint {
  const rect = svg.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  panX: number,
  panY: number,
  zoom: number
): Point2D {
  const s = clientToSvgPoint(clientX, clientY, svg);
  return screenToWorld(s.x, s.y, panX, panY, zoom);
}

export function viewportWorldRect(
  svgWidth: number,
  svgHeight: number,
  panX: number,
  panY: number,
  zoom: number,
  padMm = 8000
): { minX: number; maxX: number; minY: number; maxY: number } {
  const a = screenToWorld(0, 0, panX, panY, zoom);
  const b = screenToWorld(svgWidth, svgHeight, panX, panY, zoom);
  return {
    minX: Math.min(a.x, b.x) - padMm,
    maxX: Math.max(a.x, b.x) + padMm,
    minY: Math.min(a.y, b.y) - padMm,
    maxY: Math.max(a.y, b.y) + padMm,
  };
}
