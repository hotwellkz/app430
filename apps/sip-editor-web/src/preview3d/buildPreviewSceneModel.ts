import {
  EDITOR_LAYER_FOUNDATION,
  EDITOR_LAYER_GROUND_SCREED,
  EDITOR_LAYER_ROOF,
  EDITOR_LAYER_SLABS,
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerVisible,
} from '@2wix/editor-core';
import {
  getEffectiveWallHeight,
  getFloorById,
  getFloorsSorted,
  getRoofForTopFloor,
  getSlabsByFloor,
  getWallsByFloor,
} from '@2wix/domain-model';
import type {
  BuildingModel,
  FoundationStrip,
  Opening,
  Point2D,
  Roof,
  Wall,
  WallPanelLayoutResult,
} from '@2wix/shared-types';
import { buildRoofSurfacePositionsMeters } from './roofSurfaceGeometry';
import type {
  PreviewBoxMesh,
  PreviewBuildOptions,
  PreviewRoofSurface,
  PreviewSceneBounds,
  PreviewSceneSnapshot,
  PreviewSlabExtrusion,
} from './types';

const MM_TO_M = 1 / 1000;
const MIN_SEGMENT_MM = 20;

interface OpeningSpan {
  opening: Opening;
  from: number;
  to: number;
  bottom: number;
  top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toMeters(mm: number): number {
  return mm * MM_TO_M;
}

function makeMesh(
  id: string,
  objectType: PreviewBoxMesh['objectType'],
  sourceId: string,
  floorId: string | null,
  centerMm: { x: number; y: number; z: number },
  sizeMm: { x: number; y: number; z: number },
  rotationYRad: number
): PreviewBoxMesh {
  return {
    id,
    objectType,
    sourceId,
    floorId,
    center: {
      x: toMeters(centerMm.x),
      y: toMeters(centerMm.y),
      z: toMeters(centerMm.z),
    },
    size: {
      x: Math.max(toMeters(sizeMm.x), 0.001),
      y: Math.max(toMeters(sizeMm.y), 0.001),
      z: Math.max(toMeters(sizeMm.z), 0.001),
    },
    rotationYRad,
  };
}

function collectWallOpeningSpans(_wall: Wall, openings: Opening[], wallLengthMm: number, wallHeightMm: number): OpeningSpan[] {
  const spans: OpeningSpan[] = [];
  for (const opening of openings) {
    const half = opening.widthMm / 2;
    const from = clamp(opening.positionAlongWall - half, 0, wallLengthMm);
    const to = clamp(opening.positionAlongWall + half, 0, wallLengthMm);
    const bottom = clamp(opening.bottomOffsetMm, 0, wallHeightMm);
    const top = clamp(opening.bottomOffsetMm + opening.heightMm, 0, wallHeightMm);
    if (to - from < MIN_SEGMENT_MM || top - bottom < MIN_SEGMENT_MM) continue;
    spans.push({ opening, from, to, bottom, top });
  }
  return spans.sort((a, b) => a.from - b.from);
}

function mergeVerticalRanges(ranges: Array<{ from: number; to: number }>): Array<{ from: number; to: number }> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const out: Array<{ from: number; to: number }> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.from <= last.to) {
      last.to = Math.max(last.to, cur.to);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function buildWallMeshes(
  _model: BuildingModel,
  wall: Wall,
  floorElevationMm: number,
  floorHeightMm: number,
  openingsOnWall: Opening[],
  warnings: string[]
): { wallMeshes: PreviewBoxMesh[]; openingMeshes: PreviewBoxMesh[] } {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_SEGMENT_MM) {
    warnings.push(`Стена ${wall.id} слишком короткая и пропущена в 3D.`);
    return { wallMeshes: [], openingMeshes: [] };
  }

  const wallHeight = getEffectiveWallHeight(wall, {
    id: wall.floorId,
    label: '',
    level: 0,
    elevationMm: floorElevationMm,
    heightMm: floorHeightMm,
    floorType: 'full',
    sortIndex: 0,
  });
  const dirX = dx / length;
  const dirY = dy / length;
  const angle = Math.atan2(dirY, dirX);
  const thickness = Math.max(wall.thicknessMm, 50);

  const openingSpans = collectWallOpeningSpans(wall, openingsOnWall, length, wallHeight);
  const splitPoints = new Set<number>([0, length]);
  for (const span of openingSpans) {
    splitPoints.add(span.from);
    splitPoints.add(span.to);
  }
  const sortedPoints = [...splitPoints].sort((a, b) => a - b);

  const wallMeshes: PreviewBoxMesh[] = [];
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const from = sortedPoints[i]!;
    const to = sortedPoints[i + 1]!;
    if (to - from < MIN_SEGMENT_MM) continue;
    const mid = (from + to) / 2;
    const covering = openingSpans.filter((span) => span.from <= mid && mid <= span.to);
    const holes = mergeVerticalRanges(covering.map((span) => ({ from: span.bottom, to: span.top })));

    let solidStart = 0;
    for (const hole of holes) {
      if (hole.from - solidStart >= MIN_SEGMENT_MM) {
        const centerAlong = (from + to) / 2;
        const centerX = wall.start.x + dirX * centerAlong;
        const centerY = wall.start.y + dirY * centerAlong;
        wallMeshes.push(
          makeMesh(
            `${wall.id}:seg:${i}:${solidStart}`,
            'wall',
            wall.id,
            wall.floorId,
            {
              x: centerX,
              y: floorElevationMm + (solidStart + hole.from) / 2,
              z: centerY,
            },
            {
              x: to - from,
              y: hole.from - solidStart,
              z: thickness,
            },
            angle
          )
        );
      }
      solidStart = hole.to;
    }

    if (wallHeight - solidStart >= MIN_SEGMENT_MM) {
      const centerAlong = (from + to) / 2;
      const centerX = wall.start.x + dirX * centerAlong;
      const centerY = wall.start.y + dirY * centerAlong;
      wallMeshes.push(
        makeMesh(
          `${wall.id}:seg:${i}:${solidStart}`,
          'wall',
          wall.id,
          wall.floorId,
          {
            x: centerX,
            y: floorElevationMm + (solidStart + wallHeight) / 2,
            z: centerY,
          },
          {
            x: to - from,
            y: wallHeight - solidStart,
            z: thickness,
          },
          angle
        )
      );
    }
  }

  const openingMeshes: PreviewBoxMesh[] = openingSpans.map((span, idx) => {
    const centerAlong = (span.from + span.to) / 2;
    const centerX = wall.start.x + dirX * centerAlong;
    const centerY = wall.start.y + dirY * centerAlong;
    return makeMesh(
      `${wall.id}:opening:${idx}`,
      'opening',
      span.opening.id,
      wall.floorId,
      {
        x: centerX,
        y: floorElevationMm + (span.bottom + span.top) / 2,
        z: centerY,
      },
      {
        x: span.to - span.from,
        y: span.top - span.bottom,
        z: thickness * 1.05,
      },
      angle
    );
  });

  return { wallMeshes, openingMeshes };
}

function buildWallPanelJointMeshes(
  wall: Wall,
  layout: WallPanelLayoutResult,
  floorElevationMm: number,
  wallHeightMm: number
): PreviewBoxMesh[] {
  if (layout.direction !== 'vertical' || layout.panels.length <= 1) return [];
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_SEGMENT_MM) return [];
  const dirX = dx / length;
  const dirY = dy / length;
  const angle = Math.atan2(dirY, dirX);
  const thickness = Math.max(wall.thicknessMm, 50);
  const jointW = Math.min(90, thickness * 0.22);
  const boundaries = new Set<number>();
  for (const p of layout.panels) {
    boundaries.add(p.startOffsetMm);
    boundaries.add(p.endOffsetMm);
  }
  const sorted = [...boundaries]
    .filter((t) => t > MIN_SEGMENT_MM && t < length - MIN_SEGMENT_MM)
    .sort((a, b) => a - b);
  const meshes: PreviewBoxMesh[] = [];
  for (const t of sorted) {
    const cx = wall.start.x + dirX * t;
    const cy = wall.start.y + dirY * t;
    meshes.push(
      makeMesh(
        `wall:${wall.id}:sipJoint:${Math.round(t)}`,
        'wall',
        wall.id,
        wall.floorId,
        { x: cx, y: floorElevationMm + wallHeightMm / 2, z: cy },
        { x: jointW, y: wallHeightMm, z: thickness },
        angle
      )
    );
  }
  return meshes;
}

function computeFloorBoundingBox(walls: Wall[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (walls.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function buildRoofMeshes(
  roof: Roof,
  box: { minX: number; minY: number; maxX: number; maxY: number }
): PreviewBoxMesh[] {
  const expanded = {
    minX: box.minX - roof.overhangMm,
    minY: box.minY - roof.overhangMm,
    maxX: box.maxX + roof.overhangMm,
    maxY: box.maxY + roof.overhangMm,
  };
  const widthX = expanded.maxX - expanded.minX;
  const widthY = expanded.maxY - expanded.minY;
  const centerX = (expanded.minX + expanded.maxX) / 2;
  const centerY = (expanded.minY + expanded.maxY) / 2;
  const rise = Math.tan((roof.slopeDegrees * Math.PI) / 180) * (Math.max(widthX, widthY) / 2);
  const base = roof.baseElevationMm;

  const ridgeDirection = roof.ridgeDirection ?? 'x';
  if (roof.roofType === 'single_slope') {
    const angle = ridgeDirection === 'x' ? 0 : Math.PI / 2;
    return [
      makeMesh(
        `roof:${roof.id}:single`,
        'roof',
        roof.id,
        roof.floorId,
        { x: centerX, y: base + rise / 2 + 60, z: centerY },
        {
          x: ridgeDirection === 'x' ? widthX : widthY,
          y: Math.max(rise, 120),
          z: ridgeDirection === 'x' ? widthY : widthX,
        },
        angle
      ),
    ];
  }

  if (ridgeDirection === 'x') {
    return [
      makeMesh(
        `roof:${roof.id}:gable:left`,
        'roof',
        roof.id,
        roof.floorId,
        { x: centerX, y: base + rise / 2 + 60, z: (expanded.minY + centerY) / 2 },
        { x: widthX, y: Math.max(rise, 120), z: widthY / 2 },
        0
      ),
      makeMesh(
        `roof:${roof.id}:gable:right`,
        'roof',
        roof.id,
        roof.floorId,
        { x: centerX, y: base + rise / 2 + 60, z: (centerY + expanded.maxY) / 2 },
        { x: widthX, y: Math.max(rise, 120), z: widthY / 2 },
        0
      ),
    ];
  }

  return [
    makeMesh(
      `roof:${roof.id}:gable:left`,
      'roof',
      roof.id,
      roof.floorId,
      { x: (expanded.minX + centerX) / 2, y: base + rise / 2 + 60, z: centerY },
      { x: widthX / 2, y: Math.max(rise, 120), z: widthY },
      Math.PI / 2
    ),
    makeMesh(
      `roof:${roof.id}:gable:right`,
      'roof',
      roof.id,
      roof.floorId,
      { x: (centerX + expanded.maxX) / 2, y: base + rise / 2 + 60, z: centerY },
      { x: widthX / 2, y: Math.max(rise, 120), z: widthY },
      Math.PI / 2
    ),
  ];
}

function shouldIncludeFloor(floorId: string, options: PreviewBuildOptions): boolean {
  if (options.floorMode === 'all') return true;
  return options.activeFloorId === floorId;
}

function useLayerKeys(options: PreviewBuildOptions): boolean {
  const k = options.layerVisibilityKeys;
  return Boolean(k && Object.keys(k).length > 0);
}

function wallLayerShown(options: PreviewBuildOptions, floorId: string): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, editorLayerFloorWalls(floorId));
  }
  return options.layers.walls;
}

function openingsLayerShown(options: PreviewBuildOptions, floorId: string): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, editorLayerFloorOpenings(floorId));
  }
  return options.layers.openings;
}

function slabsLayerShown(options: PreviewBuildOptions): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, EDITOR_LAYER_SLABS);
  }
  return options.layers.slabs;
}

function roofLayerShown(options: PreviewBuildOptions): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, EDITOR_LAYER_ROOF);
  }
  return options.layers.roof;
}

function foundationLayerShown(options: PreviewBuildOptions): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, EDITOR_LAYER_FOUNDATION);
  }
  return true;
}

function groundScreedLayerShown(options: PreviewBuildOptions): boolean {
  if (useLayerKeys(options)) {
    return isEditorLayerVisible(options.layerVisibilityKeys, EDITOR_LAYER_GROUND_SCREED);
  }
  return true;
}

function bboxContourMm(pts: Point2D[]): { cx: number; cz: number; w: number; h: number } | null {
  if (pts.length < 3) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minY + maxY) / 2,
    w: Math.max(maxX - minX, 100),
    h: Math.max(maxY - minY, 100),
  };
}

function buildFoundationStripMeshes(foundation: FoundationStrip, floorElevationMm: number): PreviewBoxMesh[] {
  const out = foundation.outerContourMm;
  const n = out.length;
  if (n < 3) return [];
  const meshes: PreviewBoxMesh[] = [];
  const h = foundation.heightMm;
  const w = foundation.widthMm;
  for (let i = 0; i < n; i++) {
    const p0 = out[i]!;
    const p1 = out[(i + 1) % n]!;
    const dx = p1.x - p0.x;
    const dz = p1.y - p0.y;
    const len = Math.hypot(dx, dz);
    if (len < MIN_SEGMENT_MM) continue;
    const mx = (p0.x + p1.x) / 2;
    const mz = (p0.y + p1.y) / 2;
    const nx = -dz / len;
    const nz = dx / len;
    const cx = mx + nx * (w / 2);
    const cz = mz + nz * (w / 2);
    const angle = Math.atan2(dz, dx);
    const yCenter = floorElevationMm - h / 2;
    meshes.push(
      makeMesh(
        `foundation:${foundation.id}:seg:${i}`,
        'foundation',
        foundation.id,
        foundation.floorId,
        { x: cx, y: yCenter, z: cz },
        { x: len, y: h, z: w },
        angle
      )
    );
  }
  return meshes;
}

function calcBounds(meshes: PreviewBoxMesh[]): PreviewSceneBounds | null {
  if (meshes.length === 0) return null;
  const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY };
  const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY };
  for (const m of meshes) {
    const hx = m.size.x / 2;
    const hy = m.size.y / 2;
    const hz = m.size.z / 2;
    min.x = Math.min(min.x, m.center.x - hx);
    min.y = Math.min(min.y, m.center.y - hy);
    min.z = Math.min(min.z, m.center.z - hz);
    max.x = Math.max(max.x, m.center.x + hx);
    max.y = Math.max(max.y, m.center.y + hy);
    max.z = Math.max(max.z, m.center.z + hz);
  }
  return { min, max };
}

function mergeBoundsPair(a: PreviewSceneBounds | null, b: PreviewSceneBounds | null): PreviewSceneBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z),
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z),
    },
  };
}

function boundsFromRoofSurfacePositions(pos: Float32Array): PreviewSceneBounds | null {
  if (pos.length < 9) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]!;
    const y = pos[i + 1]!;
    const z = pos[i + 2]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

function boundsFromSlabExtrusion(e: PreviewSlabExtrusion): PreviewSceneBounds {
  const y0 = toMeters(e.bottomElevationMm);
  const y1 = y0 + toMeters(e.thicknessMm);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of e.contourMm) {
    const x = toMeters(p.x);
    const z = toMeters(p.y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { min: { x: minX, y: y0, z: minZ }, max: { x: maxX, y: y1, z: maxZ } };
}

export function buildPreviewSceneModel(model: BuildingModel, options: PreviewBuildOptions): PreviewSceneSnapshot {
  const warnings: string[] = [];
  const walls: PreviewBoxMesh[] = [];
  const wallPanelJoints: PreviewBoxMesh[] = [];
  const openings: PreviewBoxMesh[] = [];
  const slabs: PreviewBoxMesh[] = [];
  const slabExtrusions: PreviewSlabExtrusion[] = [];
  const roofSurfaces: PreviewRoofSurface[] = [];
  const roof: PreviewBoxMesh[] = [];
  const foundations: PreviewBoxMesh[] = [];
  const groundScreeds: PreviewBoxMesh[] = [];

  const floors = getFloorsSorted(model);
  for (const floor of floors) {
    if (!shouldIncludeFloor(floor.id, options)) continue;
    const floorWalls = getWallsByFloor(model, floor.id);
    const floorOpenings = model.openings.filter((o) => o.floorId === floor.id);
    const openingByWall = new Map<string, Opening[]>();
    for (const opening of floorOpenings) {
      const list = openingByWall.get(opening.wallId) ?? [];
      list.push(opening);
      openingByWall.set(opening.wallId, list);
    }

    const showWallsHere = wallLayerShown(options, floor.id);
    const showOpeningsHere = openingsLayerShown(options, floor.id);
    if (showWallsHere || showOpeningsHere) {
      for (const wall of floorWalls) {
        const built = buildWallMeshes(
          model,
          wall,
          floor.elevationMm,
          floor.heightMm,
          openingByWall.get(wall.id) ?? [],
          warnings
        );
        if (showWallsHere) {
          walls.push(...built.wallMeshes);
          const layout = model.wallPanelLayouts?.[wall.id];
          if (layout && layout.panels.length > 0) {
            const wh = getEffectiveWallHeight(wall, floor);
            wallPanelJoints.push(
              ...buildWallPanelJointMeshes(wall, layout, floor.elevationMm, wh)
            );
          }
        }
        if (showOpeningsHere) openings.push(...built.openingMeshes);
      }
    }

    if (slabsLayerShown(options)) {
      const floorSlabs = getSlabsByFloor(model, floor.id);
      const bb = computeFloorBoundingBox(floorWalls);
      for (const slab of floorSlabs) {
        const thickness = slab.thicknessMm ?? 200;
        const bottomEl =
          slab.elevationMm !== undefined && Number.isFinite(slab.elevationMm)
            ? slab.elevationMm
            : slab.slabType === 'ground'
              ? floor.elevationMm
              : floor.elevationMm + floor.heightMm - thickness;
        if (slab.contourMm && slab.contourMm.length >= 3) {
          slabExtrusions.push({
            id: `slab-ex:${slab.id}`,
            slabId: slab.id,
            floorId: floor.id,
            contourMm: slab.contourMm,
            thicknessMm: thickness,
            bottomElevationMm: bottomEl,
          });
        } else if (bb) {
          const elevation =
            slab.slabType === 'ground' ? floor.elevationMm : floor.elevationMm + floor.heightMm;
          slabs.push(
            makeMesh(
              `slab:${slab.id}`,
              'slab',
              slab.id,
              floor.id,
              {
                x: (bb.minX + bb.maxX) / 2,
                y: elevation + thickness / 2,
                z: (bb.minY + bb.maxY) / 2,
              },
              {
                x: Math.max(bb.maxX - bb.minX, 100),
                y: Math.max(thickness, 80),
                z: Math.max(bb.maxY - bb.minY, 100),
              },
              0
            )
          );
        }
      }
    }

    const fStrip = (model.foundations ?? []).find((x) => x.floorId === floor.id);
    if (fStrip && foundationLayerShown(options)) {
      foundations.push(...buildFoundationStripMeshes(fStrip, floor.elevationMm));
    }
    const gScreed = (model.groundScreeds ?? []).find((s) => s.floorId === floor.id);
    if (gScreed && groundScreedLayerShown(options)) {
      const bb = bboxContourMm(gScreed.contourMm);
      if (bb) {
        groundScreeds.push(
          makeMesh(
            `screed:${gScreed.id}`,
            'groundScreed',
            gScreed.id,
            floor.id,
            { x: bb.cx, y: floor.elevationMm - gScreed.thicknessMm / 2, z: bb.cz },
            { x: bb.w, y: Math.max(gScreed.thicknessMm, 40), z: bb.h },
            0
          )
        );
      }
    }
  }

  if (roofLayerShown(options)) {
    const topRoof = getRoofForTopFloor(model);
    if (topRoof) {
      if (options.floorMode === 'all' || options.activeFloorId === topRoof.floorId) {
        const surf = buildRoofSurfacePositionsMeters(topRoof);
        if (surf && surf.length > 0) {
          roofSurfaces.push({
            id: `roof-surf:${topRoof.id}`,
            roofId: topRoof.id,
            floorId: topRoof.floorId,
            positions: surf,
          });
        } else {
          const roofFloorWalls = getWallsByFloor(model, topRoof.floorId);
          const bb = computeFloorBoundingBox(roofFloorWalls);
          if (bb) {
            roof.push(...buildRoofMeshes(topRoof, bb));
          } else {
            warnings.push('Невозможно построить крышу: отсутствуют стены верхнего этажа.');
          }
        }
      }
    }
  }

  const allMeshes = [
    ...walls,
    ...wallPanelJoints,
    ...openings,
    ...slabs,
    ...roof,
    ...foundations,
    ...groundScreeds,
  ];
  let bounds = calcBounds(allMeshes);
  for (const se of slabExtrusions) {
    bounds = mergeBoundsPair(bounds, boundsFromSlabExtrusion(se));
  }
  for (const rs of roofSurfaces) {
    const b = boundsFromRoofSurfacePositions(rs.positions);
    if (b) bounds = mergeBoundsPair(bounds, b);
  }
  return {
    walls,
    wallPanelJoints,
    openings,
    slabs,
    slabExtrusions,
    roofSurfaces,
    roof,
    foundations,
    groundScreeds,
    warnings,
    bounds,
    stats: {
      floorsCount: floors.length,
      wallsRendered: walls.length,
      openingsRendered: openings.length,
      slabsRendered: slabs.length + slabExtrusions.length,
      slabExtrusionsRendered: slabExtrusions.length,
      roofSurfacesRendered: roofSurfaces.length,
      roofRendered: roof.length > 0 || roofSurfaces.length > 0,
      foundationsRendered: foundations.length,
      groundScreedsRendered: groundScreeds.length,
    },
  };
}

export function defaultPreviewBuildOptions(model: BuildingModel): PreviewBuildOptions {
  const firstFloor = getFloorsSorted(model)[0];
  return {
    activeFloorId: firstFloor?.id ?? null,
    floorMode: 'all',
    layers: { walls: true, openings: true, slabs: true, roof: true },
  };
}

export function getSelectedObjectFloorId(model: BuildingModel, type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === 'wall') return model.walls.find((w) => w.id === id)?.floorId ?? null;
  if (type === 'opening') return model.openings.find((o) => o.id === id)?.floorId ?? null;
  if (type === 'slab') return model.slabs.find((s) => s.id === id)?.floorId ?? null;
  if (type === 'roof') return model.roofs.find((r) => r.id === id)?.floorId ?? null;
  if (type === 'floor') return getFloorById(model, id)?.id ?? null;
  if (type === 'foundation') return model.foundations?.find((f) => f.id === id)?.floorId ?? null;
  if (type === 'groundScreed') return model.groundScreeds?.find((s) => s.id === id)?.floorId ?? null;
  return null;
}
