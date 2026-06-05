import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme:v1';

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* localStorage может быть недоступен */
  }
  return 'system';
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveEffective(mode: ThemeMode): EffectiveTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

function applyToHtml(effective: EffectiveTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', effective === 'dark');
  root.style.colorScheme = effective;
}

/**
 * Глобальная тёмная тема через класс `dark` на <html>. Tailwind уже сконфигурирован
 * на darkMode: 'class'. Поддержка трёх режимов: light / dark / system (следует за ОС).
 * Выбор сохраняется в localStorage; при system слушаем `matchMedia` и обновляемся.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored());
  const [effective, setEffective] = useState<EffectiveTheme>(() => resolveEffective(readStored()));

  useEffect(() => {
    const eff = resolveEffective(mode);
    setEffective(eff);
    applyToHtml(eff);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const eff: EffectiveTheme = mq.matches ? 'dark' : 'light';
      setEffective(eff);
      applyToHtml(eff);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* игнорируем недоступный localStorage */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(effective === 'dark' ? 'light' : 'dark');
  }, [effective, setMode]);

  return { mode, effective, setMode, toggle };
}

/**
 * Применить сохранённую тему максимально рано (до маунта React), чтобы избежать
 * вспышки светлого фона при загрузке. Вызывается из main.tsx.
 */
export function applyInitialTheme(): void {
  const mode = readStored();
  applyToHtml(resolveEffective(mode));
}
