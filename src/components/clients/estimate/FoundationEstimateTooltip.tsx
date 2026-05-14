import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FoundationEstimateTooltipProps {
  content: string;
  show: boolean;
  position?: 'top' | 'bottom';
}

interface Coords {
  top: number;
  left: number;
  width: number;
}

/**
 * Попап с формулой расчёта. Рендерится через portal в document.body
 * с position:fixed — чтобы overflow:hidden у таблицы не обрезал попап.
 * На десктопе позиционируется относительно якоря и автоматически
 * сдвигается обратно в viewport, если уезжает за край.
 * На мобиле прижимается к нижней части экрана с отступами 16px.
 */
export const FoundationEstimateTooltip: React.FC<FoundationEstimateTooltipProps> = ({
  content,
  show,
  position = 'bottom'
}) => {
  const anchorMarkerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [show]);

  useLayoutEffect(() => {
    if (!show || isMobile) {
      setCoords(null);
      return;
    }
    const anchorEl = anchorMarkerRef.current?.parentElement;
    const tooltipEl = tooltipRef.current;
    if (!anchorEl || !tooltipEl) return;

    const compute = () => {
      const aRect = anchorEl.getBoundingClientRect();
      const tRect = tooltipEl.getBoundingClientRect();
      const margin = 8;
      const gap = 10;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      let left = aRect.right - tRect.width;
      let top = position === 'top'
        ? aRect.top - tRect.height - gap
        : aRect.bottom + gap;

      if (left + tRect.width > viewportW - margin) {
        left = viewportW - margin - tRect.width;
      }
      if (left < margin) {
        left = margin;
      }

      if (position !== 'top' && top + tRect.height > viewportH - margin) {
        const altTop = aRect.top - tRect.height - gap;
        if (altTop >= margin) top = altTop;
      } else if (position === 'top' && top < margin) {
        const altTop = aRect.bottom + gap;
        if (altTop + tRect.height <= viewportH - margin) top = altTop;
      }

      setCoords({ top, left, width: tRect.width });
    };

    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [show, isMobile, position, content]);

  if (!show) return <span ref={anchorMarkerRef} aria-hidden style={{ display: 'none' }} />;

  const desktopReady = !isMobile && coords !== null;

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className={[
        'z-[2000] p-4 sm:p-6 bg-emerald-50 border border-emerald-200 rounded-lg shadow-xl',
        isMobile ? 'fixed left-4 right-4 bottom-4' : 'fixed',
        !isMobile ? 'min-w-[400px] max-w-[600px]' : '',
      ].join(' ')}
      style={{
        maxHeight: 'min(calc(100dvh - 120px), calc(100vh - 120px))',
        overflowY: 'auto',
        ...(isMobile
          ? {}
          : desktopReady
            ? { top: coords!.top, left: coords!.left }
            : { top: -9999, left: -9999, visibility: 'hidden' as const }),
      }}
    >
      <pre className="text-xs sm:text-sm text-emerald-700 whitespace-pre-wrap font-sans break-words">{content}</pre>
    </div>
  );

  return (
    <>
      <span ref={anchorMarkerRef} aria-hidden style={{ display: 'none' }} />
      {mounted ? createPortal(tooltipNode, document.body) : null}
    </>
  );
};
