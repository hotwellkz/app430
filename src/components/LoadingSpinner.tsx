import React from 'react';

/**
 * Большой брендированный preloader — используется в AuthGuard, PasswordPrompt,
 * CompanyBlockedGuard и др., где приложение ждёт начальной загрузки.
 *
 * Дизайн: два концентрических кольца вращаются в противоположные стороны
 * (внешнее ~1.2с, внутреннее ~0.9с в обратку) + пульсирующий брендовый
 * текст «2wix» в emerald-градиенте. CSS-only (Tailwind). 0 байт доп. ресурсов.
 */
export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-4">
      <div className="relative w-20 h-20">
        {/* Фоновое кольцо (бледный emerald) */}
        <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />

        {/* Внешнее активное кольцо */}
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 border-r-emerald-500 animate-spin"
          style={{ animationDuration: '1.2s' }}
        />

        {/* Внутреннее активное кольцо — вращается в обратную сторону, быстрее */}
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-emerald-400 border-l-emerald-400 animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '0.9s' }}
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-1">
        <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent animate-pulse">
          2wix
        </span>
        <span className="text-[11px] text-gray-400 tracking-[0.2em] uppercase">
          Загрузка
        </span>
      </div>
    </div>
  );
};
