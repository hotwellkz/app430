import { describe, expect, it, vi } from 'vitest';
import {
  buildCreateImportJobRequest,
  buildCreateImportJobRequestWithUploads,
  fileToImportAssetRef,
} from './buildCreateImportRequest';
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
    expect(ref.base64Data).toBeUndefined();
  });

  it('encodes raster when file.type is empty but extension is .png', async () => {
    const file = new File([Uint8Array.from([137, 80, 78, 71])], 'plan.png', { type: '' });
    const ref = await fileToImportAssetRef({
      clientId: 'c1',
      file,
      kind: 'plan',
    });
    expect(ref.mimeType).toBe('image/png');
    expect(ref.base64Data).toBeTruthy();
  });

  it('normalizes image/jpg to image/jpeg for mimeType', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpg' });
    const ref = await fileToImportAssetRef({ clientId: 'c1', file, kind: 'plan' });
    expect(ref.mimeType).toBe('image/jpeg');
    expect(ref.base64Data).toBeTruthy();
  });
});

describe('buildCreateImportJobRequestWithUploads', () => {
  it('uses upload fn and returns storage refs without base64', async () => {
    const upload = vi.fn().mockResolvedValue({
      asset: {
        id: 'client-1',
        kind: 'plan' as const,
        fileName: 'plan.png',
        mimeType: 'image/png',
        storageProvider: 'firebase' as const,
        bucket: 'b',
        storagePath: 'sip-import-sources/p1/client-1/plan.png',
        sizeBytes: 1,
      },
    });
    const body = await buildCreateImportJobRequestWithUploads('p1', [makeItem()], 'T', upload);
    expect(upload).toHaveBeenCalledWith('p1', {
      file: expect.any(File),
      id: 'client-1',
      kind: 'plan',
    });
    expect(body.sourceImages[0]?.storagePath).toContain('sip-import-sources');
    expect(body.sourceImages[0]?.base64Data).toBeUndefined();
    expect(body.projectName).toBe('T');
  });

  it('stops on first upload failure (caller handles)', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('upload failed'));
    await expect(buildCreateImportJobRequestWithUploads('p1', [makeItem(), makeItem()], undefined, upload)).rejects.toThrow(
      'upload failed'
    );
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('PDF: не вызывает upload, кладёт base64 в sourceImages', async () => {
    const upload = vi.fn();
    const pdfFile = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' });
    const body = await buildCreateImportJobRequestWithUploads(
      'p1',
      [makeItem({ file: pdfFile, clientId: 'pdf-1' })],
      undefined,
      upload
    );
    expect(upload).not.toHaveBeenCalled();
    expect(body.sourceImages).toHaveLength(1);
    expect(body.sourceImages[0]?.mimeType).toBe('application/pdf');
    expect(body.sourceImages[0]?.id).toBe('pdf-1');
    expect(body.sourceImages[0]?.base64Data).toBeTruthy();
  });
});
