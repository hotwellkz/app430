import { describe, expect, it, vi } from 'vitest';
import { OpenAiExtractorAdapter } from './openaiExtractorAdapter.js';

describe('OpenAiExtractorAdapter', () => {
  it('returns NO_IMAGES_PROVIDED when sourceImages have no base64Data', async () => {
    const adapter = new OpenAiExtractorAdapter('sk-test');
    const snap = await adapter.extractArchitecturalSnapshot({
      projectId: 'p1',
      jobId: 'j1',
      projectName: 'Test',
      sourceImages: [{ id: 'img-1', kind: 'plan', fileName: 'a.png', mimeType: 'image/png' }],
    });
    expect(snap.unresolved.some((u) => u.code === 'NO_IMAGES_PROVIDED')).toBe(true);
  });

  it('does not return NO_IMAGES_PROVIDED when at least one image has base64Data', async () => {
    const json = JSON.stringify({
      projectMeta: { name: 'T' },
      floors: [{ id: 'floor-1', label: 'F1', elevationHintMm: null }],
      outerContour: null,
      walls: [],
      openings: [],
      stairs: [],
      roofHints: null,
      dimensions: [],
      unresolved: [],
      notes: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: json } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new OpenAiExtractorAdapter('sk-test');
    const snap = await adapter.extractArchitecturalSnapshot({
      projectId: 'p1',
      jobId: 'j1',
      projectName: 'Test',
      sourceImages: [
        {
          id: 'img-1',
          kind: 'plan',
          fileName: 'a.png',
          mimeType: 'image/png',
          base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        },
      ],
    });

    expect(snap.unresolved.some((u) => u.code === 'NO_IMAGES_PROVIDED')).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });
});
