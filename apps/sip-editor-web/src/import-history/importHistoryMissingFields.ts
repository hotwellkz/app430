export interface MissingFieldUiItem {
  key: string;
  label: string;
  hint?: string;
}

const FIELD_LABELS: Record<string, { label: string; hint?: string }> = {
  importJobId: { label: 'ID import-job', hint: 'Связь с import-job источником' },
  mapperVersion: { label: 'Версия mapper', hint: 'Версия преобразования reviewed snapshot -> candidate' },
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

export function mapMissingFieldLabel(key: string): string {
  const known = FIELD_LABELS[key];
  if (known) return known.label;
  return `Неизвестное поле (${key})`;
}

export function mapMissingFieldTooltip(key: string): string | undefined {
  return FIELD_LABELS[key]?.hint;
}

export function mapMissingFieldsToUiItems(keys: string[]): MissingFieldUiItem[] {
  return keys.map((key) => ({
    key,
    label: mapMissingFieldLabel(key),
    hint: mapMissingFieldTooltip(key),
  }));
}

export function buildMissingFieldsCompactSummary(items: MissingFieldUiItem[]): string {
  if (items.length === 0) return 'Неполная legacy запись';
  if (items.length === 1) return items[0]!.label;
  if (items.length === 2) return `${items[0]!.label}, ${items[1]!.label}`;
  return `${items[0]!.label}, ${items[1]!.label} +${items.length - 2} еще`;
}
