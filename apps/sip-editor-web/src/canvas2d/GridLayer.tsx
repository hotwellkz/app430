import type { ReactElement } from 'react';

interface GridLayerProps {
  visible: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minorStepMm: number;
  majorStepMm: number;
}

/** Сетка в мировых мм (внутри группы с translate+scale). */
export function GridLayer({
  visible,
  minX,
  maxX,
  minY,
  maxY,
  minorStepMm,
  majorStepMm,
}: GridLayerProps) {
  if (!visible) return null;

  const lines: ReactElement[] = [];
  let key = 0;

  const x0 = Math.floor(minX / minorStepMm) * minorStepMm;
  const x1 = Math.ceil(maxX / minorStepMm) * minorStepMm;
  for (let x = x0; x <= x1; x += minorStepMm) {
    const major = majorStepMm > 0 && Math.abs(x % majorStepMm) < 1e-6;
    lines.push(
      <line
        key={`v${key++}`}
        x1={x}
        y1={minY}
        x2={x}
        y2={maxY}
        stroke={major ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.22)'}
        strokeWidth={major ? 1.2 : 0.8}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  const y0 = Math.floor(minY / minorStepMm) * minorStepMm;
  const y1 = Math.ceil(maxY / minorStepMm) * minorStepMm;
  for (let y = y0; y <= y1; y += minorStepMm) {
    const major = majorStepMm > 0 && Math.abs(y % majorStepMm) < 1e-6;
    lines.push(
      <line
        key={`h${key++}`}
        x1={minX}
        y1={y}
        x2={maxX}
        y2={y}
        stroke={major ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.22)'}
        strokeWidth={major ? 1.2 : 0.8}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  return <g className="sip-grid-layer">{lines}</g>;
}
