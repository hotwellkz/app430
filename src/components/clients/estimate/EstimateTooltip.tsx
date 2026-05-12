import React from 'react';

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
  if (!show) return null;

  const desktopVerticalCls =
    position === 'top'
      ? 'sm:top-auto sm:bottom-[calc(100%+10px)]'
      : 'sm:bottom-auto sm:top-[calc(100%+10px)]';

  return (
    <div
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
        overflowY: 'auto'
      }}
    >
      <pre className="text-xs sm:text-sm text-emerald-700 whitespace-pre-wrap font-sans break-words">{content}</pre>
    </div>
  );
};
