export type ImportHistoryLocale = 'ru';

export interface MissingFieldDictionaryEntry {
  label: string;
  hint?: string;
}

const RU_DICTIONARY: Record<string, MissingFieldDictionaryEntry> = {
  importJobId: { label: 'ID import-job', hint: 'Связь с import-job источником' },
  mapperVersion: {
    label: 'Версия mapper',
    hint: 'Версия преобразования reviewed snapshot в candidate',
  },
  reviewedSnapshotVersion: { label: 'Версия reviewed snapshot' },
  appliedBy: { label: 'Пользователь применения' },
  appliedAt: { label: 'Время применения' },
  warningsCount: { label: 'Количество warnings' },
  traceCount: { label: 'Количество trace-записей' },
  floorHeights: { label: 'Высоты этажей' },
  roofType: { label: 'Тип крыши' },
  internalBearingWalls: { label: 'Внутренние несущие стены' },
  scale: { label: 'Масштаб' },
};

const DICTIONARY_BY_LOCALE: Record<ImportHistoryLocale, Record<string, MissingFieldDictionaryEntry>> = {
  ru: RU_DICTIONARY,
};

export function resolveMissingFieldEntry(
  key: string,
  locale: ImportHistoryLocale = 'ru'
): MissingFieldDictionaryEntry | null {
  return DICTIONARY_BY_LOCALE[locale][key] ?? null;
}
