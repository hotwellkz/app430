import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PreviewSlabExtrusion } from './types';

export function SlabExtrusionMeshes({
  items,
  selectedObjectId,
  onSelectSlab,
}: {
  items: PreviewSlabExtrusion[];
  selectedObjectId: string | null;
  onSelectSlab: (slabId: string) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <SlabExtrusionItem
          key={item.id}
          item={item}
          selected={selectedObjectId === item.slabId}
          onSelect={() => onSelectSlab(item.slabId)}
        />
      ))}
    </>
  );
}

function SlabExtrusionItem({
  item,
  selected,
  onSelect,
}: {
  item: PreviewSlabExtrusion;
  selected: boolean;
  onSelect: () => void;
}) {
  const geom = useMemo(() => {
    const pts = item.contourMm;
    if (pts.length < 3) return null;
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x / 1000, p.y / 1000)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: item.thicknessMm / 1000, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [item]);

  useEffect(() => {
    return () => {
      geom?.dispose();
    };
  }, [geom]);

  if (!geom) return null;
  const y = item.bottomElevationMm / 1000;
  return (
    <mesh
      geometry={geom}
      position={[0, y, 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial color={selected ? '#f59e0b' : '#0284c7'} transparent opacity={0.9} />
    </mesh>
  );
}
