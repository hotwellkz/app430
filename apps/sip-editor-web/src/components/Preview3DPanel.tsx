import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import {
  EDITOR_LAYER_FOUNDATION,
  EDITOR_LAYER_GROUND_SCREED,
  EDITOR_LAYER_ROOF,
  EDITOR_LAYER_SLABS,
  useEditorStore,
} from '@2wix/editor-core';
import type { BuildingModel } from '@2wix/shared-types';
import { getFloorsSorted } from '@2wix/domain-model';
import {
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
} from '@2wix/editor-core';
import {
  buildPreviewSceneModel,
  getSelectedObjectFloorId,
} from '../preview3d/buildPreviewSceneModel';
import { RoofSurfaceMeshes } from '../preview3d/RoofSurfaceMeshes';
import { SlabExtrusionMeshes } from '../preview3d/SlabExtrusionMeshes';
import type {
  PreviewBoxMesh,
  PreviewBuildOptions,
  PreviewFloorMode,
  PreviewLayerVisibility,
} from '../preview3d/types';

interface Preview3DPanelProps {
  model: BuildingModel;
  activeFloorId: string | null;
  /** Синхронизация с панелью слоёв 2D (видимость). */
  layerVisibility: Record<string, boolean>;
}

interface SceneMeshesProps {
  items: PreviewBoxMesh[];
  color: string;
  selectedObjectId: string | null;
  onSelect?: (item: PreviewBoxMesh) => void;
}

function SceneMeshes({ items, color, selectedObjectId, onSelect }: SceneMeshesProps) {
  return (
    <>
      {items.map((item) => {
        const selected = selectedObjectId === item.sourceId;
        return (
          <mesh
            key={item.id}
            position={[item.center.x, item.center.y, item.center.z]}
            rotation={[0, item.rotationYRad, 0]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onSelect?.(item);
            }}
          >
            <boxGeometry args={[item.size.x, item.size.y, item.size.z]} />
            <meshStandardMaterial
              color={selected ? '#f59e0b' : color}
              transparent
              opacity={selected ? 0.98 : 0.9}
            />
          </mesh>
        );
      })}
    </>
  );
}

function FrameCamera({
  fitNonce,
  bounds,
}: {
  fitNonce: number;
  bounds: ReturnType<typeof buildPreviewSceneModel>['bounds'];
}) {
  const { camera } = useThree();
  const controlsRef = useRef<{
    target: { set: (x: number, y: number, z: number) => void };
    update: () => void;
  } | null>(null);

  useEffect(() => {
    if (!bounds) {
      camera.position.set(6, 6, 6);
      camera.lookAt(0, 0, 0);
      return;
    }
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;
    const cz = (bounds.min.z + bounds.max.z) / 2;
    const sx = bounds.max.x - bounds.min.x;
    const sy = bounds.max.y - bounds.min.y;
    const sz = bounds.max.z - bounds.min.z;
    const radius = Math.max(sx, sy, sz, 1);
    camera.position.set(cx + radius * 1.4, cy + radius * 1.1, cz + radius * 1.4);
    camera.lookAt(cx, cy, cz);
    controlsRef.current?.target.set(cx, cy, cz);
    controlsRef.current?.update();
  }, [bounds, camera, fitNonce]);

  return (
    <OrbitControls
      ref={(v) => {
        controlsRef.current = v as unknown as typeof controlsRef.current;
      }}
      makeDefault
      enablePan
      enableZoom
      enableRotate
    />
  );
}

export function Preview3DPanel({ model, activeFloorId, layerVisibility }: Preview3DPanelProps) {
  const selectObject = useEditorStore((s) => s.selectObject);
  const selection = useEditorStore((s) => s.selection);
  const setLayerVisibility = useEditorStore((s) => s.setLayerVisibility);
  const layersDefault: PreviewLayerVisibility = {
    walls: true,
    openings: true,
    slabs: true,
    roof: true,
  };
  const [floorMode, setFloorMode] = useState<PreviewFloorMode>('all');
  const [fitNonce, setFitNonce] = useState(0);

  const selectedFloorId = getSelectedObjectFloorId(
    model,
    selection.selectedObjectType,
    selection.selectedObjectId
  );

  const options: PreviewBuildOptions = useMemo(
    () => ({
      activeFloorId,
      floorMode,
      layers: layersDefault,
      layerVisibilityKeys: layerVisibility,
    }),
    [activeFloorId, floorMode, layerVisibility]
  );
  const snapshot = useMemo(() => buildPreviewSceneModel(model, options), [model, options]);
  const selectedId = selection.selectedObjectId;

  const floorsSorted = useMemo(() => getFloorsSorted(model), [model]);
  const allWallsVisible = floorsSorted.every(
    (f) => layerVisibility[editorLayerFloorWalls(f.id)] !== false
  );
  const allOpeningsVisible = floorsSorted.every(
    (f) => layerVisibility[editorLayerFloorOpenings(f.id)] !== false
  );
  const slabsVisible = layerVisibility[EDITOR_LAYER_SLABS] !== false;
  const roofVis = layerVisibility[EDITOR_LAYER_ROOF] !== false;
  const foundationVis = layerVisibility[EDITOR_LAYER_FOUNDATION] !== false;
  const screedVis = layerVisibility[EDITOR_LAYER_GROUND_SCREED] !== false;

  const setAllWalls = (visible: boolean) => {
    for (const f of floorsSorted) {
      setLayerVisibility(editorLayerFloorWalls(f.id), visible);
    }
  };
  const setAllOpenings = (visible: boolean) => {
    for (const f of floorsSorted) {
      setLayerVisibility(editorLayerFloorOpenings(f.id), visible);
    }
  };

  if (snapshot.bounds === null) {
    return (
      <div style={{ flex: 1, border: '1px solid var(--twix-border)', borderRadius: 8, background: '#f8fafc', padding: 16 }}>
        <p className="twix-panelTitle">3D Preview</p>
        <p className="twix-muted" style={{ fontSize: 13 }}>
          Пустая модель: добавьте стены/этажи в 2D, и здесь появится объёмный preview.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => setFitNonce((n) => n + 1)} style={{ fontSize: 12, padding: '6px 10px' }}>
          Fit model
        </button>
        <button type="button" onClick={() => setFitNonce((n) => n + 1)} style={{ fontSize: 12, padding: '6px 10px' }}>
          Reset camera
        </button>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={allWallsVisible}
            onChange={(e) => setAllWalls(e.target.checked)}
          />{' '}
          Стены
        </label>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={allOpeningsVisible}
            onChange={(e) => setAllOpenings(e.target.checked)}
          />{' '}
          Проёмы
        </label>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={slabsVisible}
            onChange={(e) => setLayerVisibility(EDITOR_LAYER_SLABS, e.target.checked)}
          />{' '}
          Перекрытия
        </label>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={roofVis}
            onChange={(e) => setLayerVisibility(EDITOR_LAYER_ROOF, e.target.checked)}
          />{' '}
          Крыша
        </label>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={foundationVis}
            onChange={(e) => setLayerVisibility(EDITOR_LAYER_FOUNDATION, e.target.checked)}
          />{' '}
          Фундамент
        </label>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={screedVis}
            onChange={(e) => setLayerVisibility(EDITOR_LAYER_GROUND_SCREED, e.target.checked)}
          />{' '}
          Стяжка
        </label>
        <label style={{ fontSize: 12 }}>
          Floors:
          <select
            value={floorMode}
            onChange={(e) => setFloorMode(e.target.value as PreviewFloorMode)}
            style={{ marginLeft: 6, fontSize: 12 }}
          >
            <option value="all">all floors</option>
            <option value="active-only">active floor only</option>
          </select>
        </label>
      </div>

      <div style={{ flex: 1, minHeight: 320, border: '1px solid var(--twix-border)', borderRadius: 8, overflow: 'hidden' }}>
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true }}>
          <color attach="background" args={['#f8fafc']} />
          <PerspectiveCamera makeDefault position={[6, 6, 6]} fov={50} near={0.01} far={1000} />
          <FrameCamera fitNonce={fitNonce} bounds={snapshot.bounds} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[8, 12, 4]} intensity={0.7} />
          <gridHelper args={[40, 40, '#cbd5e1', '#e2e8f0']} />
          <axesHelper args={[1.5]} />

          <SceneMeshes
            items={snapshot.walls}
            color="#94a3b8"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SceneMeshes
            items={snapshot.wallPanelJoints ?? []}
            color="#475569"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SceneMeshes
            items={snapshot.openings}
            color="#0f172a"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SceneMeshes
            items={snapshot.slabs}
            color="#0ea5e9"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SlabExtrusionMeshes
            items={snapshot.slabExtrusions ?? []}
            selectedObjectId={selectedId}
            onSelectSlab={(slabId) => selectObject(slabId, 'slab')}
          />
          <RoofSurfaceMeshes
            items={snapshot.roofSurfaces ?? []}
            selectedObjectId={selectedId}
            onSelectRoof={(roofId) => selectObject(roofId, 'roof')}
          />
          <SceneMeshes
            items={snapshot.foundations}
            color="#78716c"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SceneMeshes
            items={snapshot.groundScreeds}
            color="#a8a29e"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
          <SceneMeshes
            items={snapshot.roof}
            color="#ef4444"
            selectedObjectId={selectedId}
            onSelect={(item) => selectObject(item.sourceId, item.objectType)}
          />
        </Canvas>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 12 }}>3D debug</summary>
        <div style={{ fontSize: 12, marginTop: 6, display: 'grid', gap: 4 }}>
          <div>floors count: {snapshot.stats.floorsCount}</div>
          <div>walls rendered: {snapshot.stats.wallsRendered}</div>
          <div>openings rendered: {snapshot.stats.openingsRendered}</div>
          <div>slabs rendered: {snapshot.stats.slabsRendered}</div>
          <div>slab extrusions: {snapshot.stats.slabExtrusionsRendered ?? 0}</div>
          <div>roof surfaces: {snapshot.stats.roofSurfacesRendered ?? 0}</div>
          <div>foundations: {snapshot.stats.foundationsRendered}</div>
          <div>ground screeds: {snapshot.stats.groundScreedsRendered}</div>
          <div>roof rendered: {snapshot.stats.roofRendered ? 'yes' : 'no'}</div>
          <div>floor filter mode: {floorMode}</div>
          <div>
            selected: {selection.selectedObjectType ?? '—'} / {selection.selectedObjectId ?? '—'}
          </div>
          <div>selected floor: {selectedFloorId ?? '—'}</div>
          {snapshot.warnings.map((w) => (
            <div key={w} style={{ color: '#b45309' }}>
              warning: {w}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
