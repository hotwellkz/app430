import { computeWallLengthMm, wallDirectionDegrees } from '@2wix/domain-model';
import type { Wall } from '@2wix/shared-types';

interface WallLengthLabelProps {
  wall: Wall;
  visible: boolean;
  /** Масштаб вида: уменьшаем кегль в мировых мм, чтобы подпись не «разъезжалась». */
  viewZoom?: number;
}

export function WallLengthLabel({ wall, visible, viewZoom = 1 }: WallLengthLabelProps) {
  if (!visible) return null;
  const len = computeWallLengthMm(wall);
  const mx = (wall.start.x + wall.end.x) / 2;
  const my = (wall.start.y + wall.end.y) / 2;
  const deg = wallDirectionDegrees(wall);
  const labelDeg = deg > 90 || deg < -90 ? deg + 180 : deg;
  const z = Math.max(0.15, Math.min(4, viewZoom));
  const fontSize = Math.max(200, Math.min(900, 420 / z));

  return (
    <g className="sip-wall-length-label" pointerEvents="none">
      <text
        x={mx}
        y={my}
        fill="#0f172a"
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${labelDeg}, ${mx}, ${my})`}
        style={{ userSelect: 'none', paintOrder: 'stroke fill' }}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={Math.max(20, fontSize * 0.08)}
      >
        {Math.round(len)} мм
      </text>
    </g>
  );
}
