import { describe, expect, it } from 'vitest';
import { MockArchitecturalExtractorAdapter } from './mockExtractorAdapter.js';
import { resolveExtractorAdapter } from './resolveExtractorAdapter.js';
import { zArchitecturalImportSnapshot } from '../../validation/schemas.js';

describe('extractor adapters', () => {
  it('mock adapter returns valid ArchitecturalImportSnapshot', async () => {
    const adapter = new MockArchitecturalExtractorAdapter();
    const snapshot = await adapter.extractArchitecturalSnapshot({
      projectId: 'p1',
      jobId: 'ij-1',
      sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'plan.png' }],
      projectName: 'Demo',
    });
    expect(zArchitecturalImportSnapshot.safeParse(snapshot).success).toBe(true);
    expect(snapshot.projectMeta.name).toBe('Demo');
  });

  it('resolver selects mock adapter', () => {
    const adapter = resolveExtractorAdapter({ IMPORT_EXTRACTOR_MODE: 'mock' });
    expect(adapter.mode).toBe('mock');
  });
});
