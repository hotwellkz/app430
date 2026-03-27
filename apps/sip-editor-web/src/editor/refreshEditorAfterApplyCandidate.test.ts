import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import { refreshEditorAfterApplyCandidate } from './refreshEditorAfterApplyCandidate';
import * as projectsApi from '@/api/projectsApi';

vi.mock('@/api/projectsApi', () => ({
  getCurrentVersion: vi.fn(),
  getImportApplyHistory: vi.fn(),
}));

describe('refreshEditorAfterApplyCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('вызывает getCurrentVersion и onCacheUpdated', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const bump = vi.fn();
    const bm = createEmptyBuildingModel();
    vi.mocked(projectsApi.getCurrentVersion).mockResolvedValue({
      version: {
        id: 'v-new',
        projectId: 'p1',
        versionNumber: 3,
        schemaVersion: 2,
        buildingModel: bm,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: null,
      },
    });
    vi.mocked(projectsApi.getImportApplyHistory).mockResolvedValue({ items: [] });

    await refreshEditorAfterApplyCandidate(qc, 'p1', { onCacheUpdated: bump });

    expect(projectsApi.getCurrentVersion).toHaveBeenCalledWith('p1');
    expect(projectsApi.getImportApplyHistory).toHaveBeenCalledWith('p1');
    expect(bump).toHaveBeenCalledTimes(1);
  });
});
