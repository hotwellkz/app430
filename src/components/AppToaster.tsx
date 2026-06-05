import React from 'react';
import { Toaster } from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme';

/**
 * Тематический `<Toaster />` — отдельный компонент, чтобы реактивно следить
 * за `useTheme()` и обновлять стили под светлую/тёмную тему. По умолчанию
 * react-hot-toast принимает inline style, которые перекрывают любые
 * CSS-переопределения — поэтому тут единственный надёжный способ.
 */
export const AppToaster: React.FC = () => {
  const { effective } = useTheme();
  const isDark = effective === 'dark';

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: isDark ? 'rgba(24, 24, 27, 0.92)' : '#ffffff',
          color: isDark ? '#e4e4e7' : '#1f2937',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          boxShadow: isDark
            ? '0 12px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          fontSize: '0.875rem',
          backdropFilter: isDark ? 'blur(12px) saturate(140%)' : undefined,
          WebkitBackdropFilter: isDark ? 'blur(12px) saturate(140%)' : undefined,
        },
        success: {
          style: {
            background: isDark ? 'rgba(6, 78, 59, 0.55)' : '#f0fdf4',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #dcfce7',
            color: isDark ? '#a7f3d0' : '#166534',
          },
          iconTheme: {
            primary: isDark ? '#34d399' : '#22c55e',
            secondary: isDark ? '#0a0a0b' : '#ffffff',
          },
        },
        error: {
          style: {
            background: isDark ? 'rgba(127, 29, 29, 0.55)' : '#fef2f2',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fee2e2',
            color: isDark ? '#fecaca' : '#991b1b',
          },
          iconTheme: {
            primary: isDark ? '#f87171' : '#ef4444',
            secondary: isDark ? '#0a0a0b' : '#ffffff',
          },
          duration: 4000,
        },
      }}
    />
  );
};
