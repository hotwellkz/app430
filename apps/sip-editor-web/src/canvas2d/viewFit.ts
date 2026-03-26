import type { Wall } from '@2wix/shared-types';
import { clampEditorZoom } from '@2wix/editor-core';
import { wallFootprintCorners } from './wallOutline.js';

export function computeWallsBoundingBoxMm(walls: Wall[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (walls.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    for (const p of wallFootprintCorners(w)) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function computeFitViewTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewportW: number,
  viewportH: number,
  paddingMm: number
): { zoom: number; panX: number; panY: number } {
  const rawW = bounds.maxX - bounds.minX + 2 * paddingMm;
  const rawH = bounds.maxY - bounds.minY + 2 * paddingMm;
  const bw = Math.max(rawW, 800);
  const bh = Math.max(rawH, 600);
  const z = Math.min(viewportW / bw, viewportH / bh);
  const zoom = clampEditorZoom(z * 0.92);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const panX = viewportW / 2 - cx * zoom;
  const panY = viewportH / 2 - cy * zoom;
  return { zoom, panX, panY };
}
