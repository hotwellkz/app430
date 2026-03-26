import type { ImportApplyHistoryItem } from '@2wix/shared-types';
import {
  buildMissingFieldsCompactSummary,
  mapMissingFieldsToUiItems,
  type MissingFieldUiItem,
} from './importHistoryMissingFields';

export type ImportHistoryBadgeKind = 'neutral' | 'warning' | 'danger';

export interface ImportApplyHistoryViewItem {
  id: string;
  appliedAt: string;
  appliedBy: string;
  importJobId: string;
  mapperVersion: string;
  reviewedSnapshotVersion: string;
  warningsCount: number;
  traceCount: number;
  isLegacy: boolean;
  isIncomplete: boolean;
  missingFields: string[];
  missingFieldUiItems: MissingFieldUiItem[];
  missingFieldsCompact: string;
  badgeKind: ImportHistoryBadgeKind;
  badgeLabel: string;
  subtitle: string;
  isInspectable: boolean;
}

function compactId(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function normalizeMissingFields(fields: string[] | undefined): string[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 6);
}

function buildSubtitle(item: ImportApplyHistoryItem, missingFields: string[]): string {
  if (item.isLegacy && item.isIncomplete) {
    const head = 'Неполная legacy запись';
    if (missingFields.length === 0) return head;
    return `${head}: ${missingFields.join(', ')}`;
  }
  return `by ${item.appliedBy} · mapper ${item.mapperVersion} · warnings ${item.warningsCount}`;
}

function badgeFor(item: ImportApplyHistoryItem): { kind: ImportHistoryBadgeKind; label: string } {
  if (item.isLegacy && item.isIncomplete) {
    return { kind: 'danger', label: 'Incomplete legacy' };
  }
  if (item.isLegacy) {
    return { kind: 'warning', label: 'Legacy' };
  }
  return { kind: 'neutral', label: 'AI import' };
}

export function mapImportApplyHistoryItemToView(
  item: ImportApplyHistoryItem
): ImportApplyHistoryViewItem {
  const missingFields = normalizeMissingFields(item.missingFields);
  const missingFieldUiItems = mapMissingFieldsToUiItems(missingFields);
  const badge = badgeFor(item);
  return {
    id: item.versionId,
    appliedAt: item.appliedAt,
    appliedBy: item.appliedBy,
    importJobId: compactId(item.importJobId),
    mapperVersion: item.mapperVersion,
    reviewedSnapshotVersion: item.reviewedSnapshotVersion,
    warningsCount: item.warningsCount,
    traceCount: item.traceCount,
    isLegacy: Boolean(item.isLegacy),
    isIncomplete: Boolean(item.isIncomplete),
    missingFields,
    missingFieldUiItems,
    missingFieldsCompact: buildMissingFieldsCompactSummary(missingFieldUiItems),
    badgeKind: badge.kind,
    badgeLabel: badge.label,
    subtitle: buildSubtitle(item, missingFields),
    isInspectable: false,
  };
}

export function mapImportApplyHistoryToView(
  items: ImportApplyHistoryItem[]
): ImportApplyHistoryViewItem[] {
  return items.map(mapImportApplyHistoryItemToView);
}
