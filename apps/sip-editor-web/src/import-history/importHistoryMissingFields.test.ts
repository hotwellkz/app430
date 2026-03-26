import { describe, expect, it } from 'vitest';
import {
  buildMissingFieldsCompactSummary,
  mapMissingFieldLabel,
  mapMissingFieldsToUiItems,
} from './importHistoryMissingFields';

describe('importHistoryMissingFields', () => {
  it('maps known field to human-readable label', () => {
    expect(mapMissingFieldLabel('appliedAt')).toBe('Время применения');
  });

  it('maps unknown field to safe fallback label', () => {
    expect(mapMissingFieldLabel('unknown_field')).toBe('Неизвестное поле (unknown_field)');
  });

  it('builds compact summary for one field', () => {
    const items = mapMissingFieldsToUiItems(['appliedAt']);
    expect(buildMissingFieldsCompactSummary(items)).toBe('Время применения');
  });

  it('builds compact summary for two fields', () => {
    const items = mapMissingFieldsToUiItems(['appliedAt', 'appliedBy']);
    expect(buildMissingFieldsCompactSummary(items)).toBe('Время применения, Пользователь применения');
  });

  it('builds compact summary for 3+ fields', () => {
    const items = mapMissingFieldsToUiItems(['appliedAt', 'appliedBy', 'importJobId']);
    expect(buildMissingFieldsCompactSummary(items)).toBe('Время применения, Пользователь применения +1 еще');
  });
});
