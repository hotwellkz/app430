import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../hooks/useTheme';

interface ThemeToggleProps {
  /** Компактный режим: одна кнопка-иконка, циклит light → dark → system → light. */
  compact?: boolean;
  /** Скрыть текстовую подпись (для свёрнутого Sidebar). */
  iconOnly?: boolean;
  className?: string;
}

const MODE_ICON: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="w-4 h-4" aria-hidden />,
  dark: <Moon className="w-4 h-4" aria-hidden />,
  system: <Monitor className="w-4 h-4" aria-hidden />
};

const MODE_LABEL: Record<ThemeMode, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  system: 'Системная'
};

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light'
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, iconOnly = false, className }) => {
  const { mode, setMode } = useTheme();

  if (compact || iconOnly) {
    return (
      <button
        type="button"
        onClick={() => setMode(NEXT_MODE[mode])}
        className={`flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 hover:bg-white dark:text-zinc-300 dark:hover:text-emerald-400 dark:hover:bg-white/5 rounded-lg transition-all duration-200 group ${
          iconOnly ? 'justify-center p-2' : 'px-4 py-2'
        } ${className ?? ''}`}
        title={`Тема: ${MODE_LABEL[mode]} — нажмите, чтобы переключить`}
        aria-label={`Переключить тему (сейчас: ${MODE_LABEL[mode]})`}
      >
        <span className="transition-transform duration-200 group-hover:scale-110">{MODE_ICON[mode]}</span>
        {!iconOnly && <span>Тема: {MODE_LABEL[mode]}</span>}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-0.5 ${className ?? ''}`}>
      {(['light', 'system', 'dark'] as ThemeMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`flex items-center justify-center gap-1 h-7 px-2 rounded-full text-xs font-medium transition-colors ${
            mode === m
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-white/10'
          }`}
          aria-pressed={mode === m}
          title={MODE_LABEL[m]}
        >
          {MODE_ICON[m]}
        </button>
      ))}
    </div>
  );
};
