import { parsePositiveMmString } from '@2wix/domain-model';
import type { Point2D } from '@2wix/shared-types';
import { useEffect, useState } from 'react';

const MIN_EDGE = 50;

type Props = {
  cornerA: Point2D;
  cursor: Point2D;
  onApplySizeMm: (widthMm: number, heightMm: number) => void;
};

/** Плавающая панель: точные ширина/высота прямоугольника до второго клика. */
export function RectangleDrawHud({ cornerA, cursor, onApplySizeMm }: Props) {
  const minX = Math.min(cornerA.x, cursor.x);
  const maxX = Math.max(cornerA.x, cursor.x);
  const minY = Math.min(cornerA.y, cursor.y);
  const maxY = Math.max(cornerA.y, cursor.y);
  const bw = Math.max(MIN_EDGE, Math.round(maxX - minX));
  const bh = Math.max(MIN_EDGE, Math.round(maxY - minY));

  const [wStr, setWStr] = useState(String(bw));
  const [hStr, setHStr] = useState(String(bh));

  useEffect(() => {
    setWStr(String(bw));
    setHStr(String(bh));
  }, [bw, bh]);

  const apply = () => {
    const w = parsePositiveMmString(wStr, MIN_EDGE);
    const h = parsePositiveMmString(hStr, MIN_EDGE);
    if (w === null || h === null) return;
    onApplySizeMm(w, h);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        zIndex: 6,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#0f172a' }}>Прямоугольник (мм)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 6, alignItems: 'center' }}>
        <label htmlFor="rect-w">Ширина</label>
        <input
          id="rect-w"
          type="text"
          inputMode="decimal"
          value={wStr}
          onChange={(e) => setWStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') {
              setWStr(String(bw));
              setHStr(String(bh));
            }
          }}
          style={{ padding: '4px 6px', width: '100%' }}
        />
        <label htmlFor="rect-h">Высота</label>
        <input
          id="rect-h"
          type="text"
          inputMode="decimal"
          value={hStr}
          onChange={(e) => setHStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') {
              setWStr(String(bw));
              setHStr(String(bh));
            }
          }}
          style={{ padding: '4px 6px', width: '100%' }}
        />
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={apply} style={{ padding: '4px 10px', fontSize: 12 }}>
          Применить размеры
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>Enter — применить · Esc — сбросить поля</span>
      </div>
    </div>
  );
}
