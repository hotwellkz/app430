import { describe, expect, it, vi, beforeEach } from 'vitest';
import { hydrateImportAssetsForExtraction } from './importSourceHydration.js';

const { mockFile, mockBucket } = vi.hoisted(() => {
  const mockFile = vi.fn();
  const mockBucket = {
    name: 'test-bucket',
    file: mockFile,
  };
  return { mockFile, mockBucket };
});

vi.mock('../../firestore/admin.js', () => ({
  getStorageBucket: () => mockBucket,
}));

describe('hydrateImportAssetsForExtraction', () => {
  const fileOps = {
    exists: vi.fn(),
    download: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFile.mockReturnValue(fileOps);
    fileOps.exists.mockResolvedValue([true]);
    fileOps.download.mockResolvedValue([Buffer.from('abc')]);
  });

  it('passes through when base64Data already set', async () => {
    const out = await hydrateImportAssetsForExtraction('p1', [
      { id: '1', kind: 'plan', fileName: 'a.png', base64Data: 'QQ==' },
    ]);
    expect(out[0]?.base64Data).toBe('QQ==');
    expect(mockFile).not.toHaveBeenCalled();
  });

  it('downloads firebase storage ref and fills base64', async () => {
    const out = await hydrateImportAssetsForExtraction('p1', [
      {
        id: '1',
        kind: 'plan',
        fileName: 'a.png',
        storageProvider: 'firebase',
        storagePath: 'sip-import-sources/p1/x/a.png',
      },
    ]);
    expect(mockFile).toHaveBeenCalledWith('sip-import-sources/p1/x/a.png');
    expect(out[0]?.base64Data).toBe(Buffer.from('abc').toString('base64'));
    expect(out[0]?.bucket).toBe('test-bucket');
  });

  it('throws clear error when object missing', async () => {
    fileOps.exists.mockResolvedValue([false]);
    await expect(
      hydrateImportAssetsForExtraction('p1', [
        {
          id: '1',
          kind: 'plan',
          fileName: 'a.png',
          storageProvider: 'firebase',
          storagePath: 'sip-import-sources/p1/x/missing.png',
        },
      ])
    ).rejects.toThrow(/не найден/);
  });

  it('rejects storage path outside project prefix', async () => {
    await expect(
      hydrateImportAssetsForExtraction('p1', [
        {
          id: '1',
          kind: 'plan',
          fileName: 'a.png',
          storageProvider: 'firebase',
          storagePath: 'other-bucket/evil',
        },
      ])
    ).rejects.toThrow(/Недопустимый storagePath/);
  });
});
