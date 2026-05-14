import React, { useLayoutEffect, useRef, useState } from 'react';

interface EstimateTooltipProps {
  content: string;
  show: boolean;
  position?: 'top' | 'bottom';
}

export const EstimateTooltip: React.FC<EstimateTooltipProps> = ({
  content,
  show,
  position = 'bottom'
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shiftX, setShiftX] = useState(0);

  // На десктопе попап позиционируется absolute относительно якоря (`sm:right-0`).
  // Если якорь близко к левому или правому краю окна — попап вылезает за
  // viewport. Мерим rect и сдвигаем через translateX, чтобы вернуть его в зону
  // видимости. На мобиле попап fixed left-4 right-4 — JS-коррекция не нужна.
  useLayoutEffect(() => {
    if (!show) {
      setShiftX(0);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(max-width: 639px)').matches) return;

    setShiftX(0);
    // Замер на следующем кадре, чтобы CSS-классы успели применить базовую
    // позицию до измерения.
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const margin = 8;
      let dx = 0;
      if (rect.right > window.innerWidth - margin) {
        dx = window.innerWidth - margin - rect.right;
      } else if (rect.left < margin) {
        dx = margin - rect.left;
      }
      if (dx !== 0) setShiftX(dx);
    });
    return () => cancelAnimationFrame(raf);
  }, [show, content]);

  if (!show) return null;

  const desktopVerticalCls =
    position === 'top'
      ? 'sm:top-auto sm:bottom-[calc(100%+10px)]'
      : 'sm:bottom-auto sm:top-[calc(100%+10px)]';

  return (
    <div
      ref={ref}
      className={[
        'z-50 p-4 sm:p-6 bg-emerald-50 border border-emerald-200 rounded-lg shadow-xl',
        // Мобила: fixed в нижней части viewport, с отступами от краёв
        'fixed left-4 right-4 bottom-4',
        // Десктоп: absolute рядом с якорем
        'sm:absolute sm:left-auto sm:right-0 sm:bottom-auto',
        desktopVerticalCls,
        'sm:w-auto sm:min-w-[400px] sm:max-w-[600px]',
      ].join(' ')}
      style={{
        maxHeight: 'min(calc(100dvh - 120px), calc(100vh - 120px))',
        overflowY: 'auto',
        // На десктопе сдвигаем, чтобы попап не вылезал за viewport.
        // На мобиле shiftX = 0, поэтому transform нейтрален.
        transform: shiftX !== 0 ? `translateX(${shiftX}px)` : undefined,
      }}
    >
      <pre className="text-xs sm:text-sm text-emerald-700 whitespace-pre-wrap font-sans break-words">{content}</pre>
    </div>
  );
};
