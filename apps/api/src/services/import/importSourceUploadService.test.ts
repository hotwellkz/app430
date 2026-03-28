import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadImportRasterAndBuildRef } from './importSourceUploadService.js';

const { mockSave, mockBucket } = vi.hoisted(() => {
  const mockSave = vi.fn();
  const mockFile = vi.fn(() => ({ save: mockSave }));
  const mockBucket = {
    name: 'unit-test-bucket',
    file: mockFile,
  };
  return { mockSave, mockBucket };
});

vi.mock('../../firestore/admin.js', () => ({
  getStorageBucket: () => mockBucket,
}));

describe('uploadImportRasterAndBuildRef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  it('writes buffer to storage and returns firebase ref', async () => {
    const buf = Buffer.from([1, 2, 3]);
    const ref = await uploadImportRasterAndBuildRef({
      projectId: 'p1',
      assetId: 'asset-1',
      kind: 'plan',
      originalFileName: 'plan.png',
      mimeType: 'image/png',
      buffer: buf,
    });
    expect(ref.storageProvider).toBe('firebase');
    expect(ref.storagePath?.startsWith('sip-import-sources/p1/asset-1/')).toBe(true);
    expect(ref.bucket).toBe('unit-test-bucket');
    expect(ref.sizeBytes).toBe(3);
    expect(ref.checksumSha256).toHaveLength(64);
    expect(mockSave).toHaveBeenCalled();
  });

  it('rejects PDF mime', async () => {
    await expect(
      uploadImportRasterAndBuildRef({
        projectId: 'p1',
        assetId: 'a',
        kind: 'plan',
        originalFileName: 'x.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('x'),
      })
    ).rejects.toThrow(/растровые/);
  });

  it('оборачивает сбой Storage в сообщение про Storage', async () => {
    mockSave.mockRejectedValueOnce(new Error('permission denied'));
    await expect(
      uploadImportRasterAndBuildRef({
        projectId: 'p1',
        assetId: 'a',
        kind: 'plan',
        originalFileName: 'plan.png',
        mimeType: 'image/png',
        buffer: Buffer.from([1]),
      })
    ).rejects.toThrow(/Не удалось сохранить файл в Storage/);
  });
});
