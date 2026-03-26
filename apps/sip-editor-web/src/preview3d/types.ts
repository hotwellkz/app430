import type { EditorObjectType } from '@2wix/editor-core';

export type PreviewFloorMode = 'all' | 'active-only';

export interface PreviewLayerVisibility {
  walls: boolean;
  openings: boolean;
  slabs: boolean;
  roof: boolean;
}

export interface PreviewBuildOptions {
  activeFloorId: string | null;
  floorMode: PreviewFloorMode;
  layers: PreviewLayerVisibility;
}

export interface PreviewBoxMesh {
  id: string;
  objectType: EditorObjectType;
  sourceId: string;
  floorId: string | null;
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  rotationYRad: number;
}

export interface PreviewSceneStats {
  floorsCount: number;
  wallsRendered: number;
  openingsRendered: number;
  slabsRendered: number;
  roofRendered: boolean;
}

export interface PreviewSceneBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface PreviewSceneSnapshot {
  walls: PreviewBoxMesh[];
  openings: PreviewBoxMesh[];
  slabs: PreviewBoxMesh[];
  roof: PreviewBoxMesh[];
  stats: PreviewSceneStats;
  warnings: string[];
  bounds: PreviewSceneBounds | null;
}
