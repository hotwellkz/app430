import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PreviewRoofSurface } from './types';

export function RoofSurfaceMeshes({
  items,
  selectedObjectId,
  onSelectRoof,
}: {
  items: PreviewRoofSurface[];
  selectedObjectId: string | null;
  onSelectRoof: (roofId: string) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <RoofSurfaceItem
          key={item.id}
          item={item}
          selected={selectedObjectId === item.roofId}
          onSelect={() => onSelectRoof(item.roofId)}
        />
      ))}
    </>
  );
}

function RoofSurfaceItem({
  item,
  selected,
  onSelect,
}: {
  item: PreviewRoofSurface;
  selected: boolean;
  onSelect: () => void;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(item.positions, 3));
    g.computeVertexNormals();
    return g;
  }, [item.positions]);

  useEffect(() => {
    return () => {
      geom.dispose();
    };
  }, [geom]);

  return (
    <mesh
      geometry={geom}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={selected ? '#f59e0b' : '#b91c1c'}
        side={THREE.DoubleSide}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}
