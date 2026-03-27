import { describe, expect, it } from 'vitest';
import { defaultImportWizardForm } from './importWizardTypes';
import { formatImportWizardSummary } from './formatImportWizardSummary';

describe('formatImportWizardSummary', () => {
  it('formats counts by kind and key fields', () => {
    const f = new File([''], 'a.png');
    const files = [
      { clientId: '1', file: f, kind: 'plan' as const },
      { clientId: '2', file: f, kind: 'plan' as const },
      { clientId: '3', file: f, kind: 'facade' as const },
    ];
    const form = defaultImportWizardForm();
    const text = formatImportWizardSummary(files, form);
    expect(text).toContain('Файлов: 3');
    expect(text).toContain('план: 2');
    expect(text).toContain('фасад: 1');
    expect(text).toContain('Этажность: 1');
  });

  it('includes second floor line when floorCount is 2', () => {
    const f = new File([''], 'a.png');
    const form = {
      ...defaultImportWizardForm(),
      floorCount: 2 as const,
      floor1HeightMm: 3000,
      floor2HeightMm: 2700,
    };
    const text = formatImportWizardSummary([{ clientId: '1', file: f, kind: 'plan' }], form);
    expect(text).toContain('Этажность: 2');
    expect(text).toContain('Высота 2 этажа: 2700');
  });
});
