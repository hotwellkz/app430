import { describe, expect, it } from 'vitest';
import type { ImportApplyHistoryItem } from '@2wix/shared-types';
import { mapImportApplyHistoryItemToView } from './importApplyHistoryViewModel';

function baseItem(overrides?: Partial<ImportApplyHistoryItem>): ImportApplyHistoryItem {
  return {
    versionId: 'v1',
    versionNumber: 1,
    sourceKind: 'ai_import',
    importJobId: 'ij-1234567890abcdef',
    mapperVersion: 'import-candidate-v2',
    reviewedSnapshotVersion: 'r1',
    appliedBy: 'u1',
    appliedAt: '2026-03-26T12:00:00.000Z',
    warningsCount: 1,
    traceCount: 2,
    note: null,
    ...overrides,
  };
}

describe('importApplyHistoryViewModel', () => {
  it('maps normal item with neutral badge', () => {
    const vm = mapImportApplyHistoryItemToView(baseItem());
    expect(vm.badgeKind).toBe('neutral');
    expect(vm.badgeLabel).toBe('AI import');
    expect(vm.isLegacy).toBe(false);
    expect(vm.isIncomplete).toBe(false);
  });

  it('maps legacy complete-ish item with warning badge', () => {
    const vm = mapImportApplyHistoryItemToView(
      baseItem({
        isLegacy: true,
        isIncomplete: false,
      })
    );
    expect(vm.badgeKind).toBe('warning');
    expect(vm.badgeLabel).toBe('Legacy');
    expect(vm.isLegacy).toBe(true);
    expect(vm.isIncomplete).toBe(false);
  });

  it('maps incomplete legacy item with danger badge and compact missing fields', () => {
    const vm = mapImportApplyHistoryItemToView(
      baseItem({
        isLegacy: true,
        isIncomplete: true,
        missingFields: ['mapperVersion', 'appliedBy', 'traceCount', 'warningsCount', 'importJobId', 'appliedAt', 'extra'],
      })
    );
    expect(vm.badgeKind).toBe('danger');
    expect(vm.badgeLabel).toBe('Incomplete legacy');
    expect(vm.missingFields.length).toBe(6);
    expect(vm.missingFieldUiItems[0]?.label).toBe('Версия mapper');
    expect(vm.missingFieldsCompact).toContain('+4 еще');
    expect(vm.subtitle).toContain('Неполная legacy запись');
  });

  it('normalizes missing fields predictably', () => {
    const vm = mapImportApplyHistoryItemToView(
      baseItem({
        isLegacy: true,
        isIncomplete: true,
        missingFields: [' ', 'appliedAt', '', 'reviewedSnapshotVersion'],
      })
    );
    expect(vm.missingFields).toEqual(['appliedAt', 'reviewedSnapshotVersion']);
    expect(vm.missingFieldUiItems.map((x) => x.label)).toEqual([
      'Время применения',
      'Версия reviewed snapshot',
    ]);
  });

  it('unknown missing field uses fallback label', () => {
    const vm = mapImportApplyHistoryItemToView(
      baseItem({
        isLegacy: true,
        isIncomplete: true,
        missingFields: ['mystery_field'],
      })
    );
    expect(vm.missingFieldUiItems[0]?.label).toBe('Неизвестное поле (mystery_field)');
  });
});
