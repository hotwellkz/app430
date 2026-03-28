import { describe, expect, it } from 'vitest';
import { defaultImportWizardForm } from './importWizardTypes';
import { validateImportWizard } from './validateImportWizard';

function makeFile(name = 'a.png'): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('validateImportWizard', () => {
  it('fails without files', () => {
    const form = defaultImportWizardForm();
    const r = validateImportWizard([], form);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('файл'))).toBe(true);
  });

  it('fails when floor1 height invalid', () => {
    const f = makeFile();
    const form = { ...defaultImportWizardForm(), floor1HeightMm: 0 };
    const r = validateImportWizard([{ clientId: 'c1', file: f, kind: 'plan' }], form);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('1 этажа'))).toBe(true);
  });

  it('requires floor2 height when floorCount is 2', () => {
    const f = makeFile();
    const form = { ...defaultImportWizardForm(), floorCount: 2 as const, floor2HeightMm: 0 };
    const r = validateImportWizard([{ clientId: 'c1', file: f, kind: 'plan' }], form);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('2 этажа'))).toBe(true);
  });

  it('requires mmPerPixel when scale is exact', () => {
    const f = makeFile();
    const form = { ...defaultImportWizardForm(), scale: 'exact', mmPerPixel: 0 };
    const r = validateImportWizard([{ clientId: 'c1', file: f, kind: 'plan' }], form);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('масштаб') || e.includes('пиксель'))).toBe(true);
  });

  it('passes with minimal valid data', () => {
    const f = makeFile();
    const form = defaultImportWizardForm();
    const r = validateImportWizard([{ clientId: 'c1', file: f, kind: 'plan' }], form);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('fails when only PDF is attached (no raster for AI)', () => {
    const pdf = new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' });
    const form = defaultImportWizardForm();
    const r = validateImportWizard([{ clientId: 'c1', file: pdf, kind: 'plan' }], form);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('PDF') || e.includes('растров'))).toBe(true);
  });
});
