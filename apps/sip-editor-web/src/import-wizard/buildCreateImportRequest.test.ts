import { describe, expect, it } from 'vitest';
import { buildCreateImportJobRequest, fileToImportAssetRef } from './buildCreateImportRequest';
import type { WizardFileItem } from './importWizardTypes';

function makeItem(overrides: Partial<WizardFileItem> = {}): WizardFileItem {
  const file = new File(['x'], 'plan.png', { type: 'image/png' });
  return {
    clientId: 'client-1',
    file,
    kind: 'plan',
    ...overrides,
  };
}

describe('buildCreateImportJobRequest', () => {
  it('maps files to sourceImages with kinds', async () => {
    const body = await buildCreateImportJobRequest(
      [
        makeItem({ kind: 'plan' }),
        makeItem({
          kind: 'facade',
          file: new File(['x'], 'f.jpg', { type: 'image/jpeg' }),
        }),
      ],
      'Мой проект'
    );
    expect(body.sourceImages).toHaveLength(2);
    expect(body.sourceImages[0].id).toBeTruthy();
    expect(body.sourceImages[0].kind).toBe('plan');
    expect(body.sourceImages[0].fileName).toBe('plan.png');
    expect(body.sourceImages[1].kind).toBe('facade');
    expect(body.projectName).toBe('Мой проект');
  });

  it('omits projectName when title empty', async () => {
    const body = await buildCreateImportJobRequest([makeItem()], '   ');
    expect(body.projectName).toBeUndefined();
  });

  it('fileToImportAssetRef uses file metadata', async () => {
    const item = makeItem({ kind: 'other', file: new File([''], 'doc.pdf', { type: 'application/pdf' }) });
    const ref = await fileToImportAssetRef(item);
    expect(ref.kind).toBe('other');
    expect(ref.fileName).toBe('doc.pdf');
    expect(ref.mimeType).toBe('application/pdf');
  });
});
