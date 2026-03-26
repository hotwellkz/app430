import { computeWallLengthMm } from '@2wix/domain-model';
import type { Wall } from '@2wix/shared-types';

interface WallLengthLabelProps {
  wall: Wall;
  visible: boolean;
}

export function WallLengthLabel({ wall, visible }: WallLengthLabelProps) {
  if (!visible) return null;
  const len = computeWallLengthMm(wall);
  const mx = (wall.start.x + wall.end.x) / 2;
  const my = (wall.start.y + wall.end.y) / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const labelDeg = deg > 90 || deg < -90 ? deg + 180 : deg;

  return (
    <g className="sip-wall-length-label" pointerEvents="none">
      <text
        x={mx}
        y={my}
        fill="#0f172a"
        fontSize={450}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${labelDeg}, ${mx}, ${my})`}
        style={{ userSelect: 'none' }}
      >
        {Math.round(len)} мм
      </text>
    </g>
  );
}
