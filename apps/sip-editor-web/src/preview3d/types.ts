import type { EditorObjectType } from '@2wix/editor-core';
import type { Point2D } from '@2wix/shared-types';

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
  /**
   * Ключи слоёв редактора (`floor-walls:*`, `floor-openings:*`, `layer-slabs`, …).
   * Если задано и не пусто — фильтрация по нему (пропуск ключа = видимо).
   */
  layerVisibilityKeys?: Record<string, boolean>;
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
  slabExtrusionsRendered: number;
  roofSurfacesRendered: number;
  roofRendered: boolean;
  foundationsRendered: number;
  groundScreedsRendered: number;
}

/** Перекрытие с контуром — экструзия в 3D (не box). */
export interface PreviewSlabExtrusion {
  id: string;
  slabId: string;
  floorId: string;
  contourMm: Point2D[];
  thicknessMm: number;
  bottomElevationMm: number;
}

/** Скаты крыши по контуру карниза (треугольники в м). */
export interface PreviewRoofSurface {
  id: string;
  roofId: string;
  floorId: string;
  positions: Float32Array;
}

export interface PreviewSceneBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface PreviewSceneSnapshot {
  walls: PreviewBoxMesh[];
  /** Тонкие маркеры стыков SIP-панелей вдоль стены (если есть сохранённая раскладка). */
  wallPanelJoints: PreviewBoxMesh[];
  openings: PreviewBoxMesh[];
  slabs: PreviewBoxMesh[];
  slabExtrusions: PreviewSlabExtrusion[];
  roofSurfaces: PreviewRoofSurface[];
  roof: PreviewBoxMesh[];
  foundations: PreviewBoxMesh[];
  groundScreeds: PreviewBoxMesh[];
  stats: PreviewSceneStats;
  warnings: string[];
  bounds: PreviewSceneBounds | null;
}
