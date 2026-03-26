export interface MissingFieldUiItem {
  key: string;
  label: string;
  hint?: string;
}
import {
  resolveMissingFieldEntry,
  type ImportHistoryLocale,
} from './importHistoryMissingFieldDictionary';

export function mapMissingFieldLabel(key: string, locale: ImportHistoryLocale = 'ru'): string {
  const known = resolveMissingFieldEntry(key, locale);
  if (known) return known.label;
  return `Неизвестное поле (${key})`;
}

export function mapMissingFieldTooltip(
  key: string,
  locale: ImportHistoryLocale = 'ru'
): string | undefined {
  return resolveMissingFieldEntry(key, locale)?.hint;
}

export function mapMissingFieldsToUiItems(
  keys: string[],
  locale: ImportHistoryLocale = 'ru'
): MissingFieldUiItem[] {
  return keys.map((key) => ({
    key,
    label: mapMissingFieldLabel(key, locale),
    hint: mapMissingFieldTooltip(key, locale),
  }));
}

export function buildMissingFieldsCompactSummary(items: MissingFieldUiItem[]): string {
  if (items.length === 0) return 'Неполная legacy запись';
  if (items.length === 1) return items[0]!.label;
  if (items.length === 2) return `${items[0]!.label}, ${items[1]!.label}`;
  return `${items[0]!.label}, ${items[1]!.label} +${items.length - 2} еще`;
}
