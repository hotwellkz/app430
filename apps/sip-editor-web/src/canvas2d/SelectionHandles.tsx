import type { Wall } from '@2wix/shared-types';

interface SelectionHandlesProps {
  wall: Wall;
  radiusMm: number;
}

export function SelectionHandles({ wall, radiusMm }: SelectionHandlesProps) {
  const r = radiusMm;
  return (
    <g className="sip-wall-handles" pointerEvents="all">
      <circle
        cx={wall.start.x}
        cy={wall.start.y}
        r={r}
        fill="#fff"
        stroke="#2563eb"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        data-handle="start"
      />
      <circle
        cx={wall.end.x}
        cy={wall.end.y}
        r={r}
        fill="#fff"
        stroke="#2563eb"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        data-handle="end"
      />
    </g>
  );
}
