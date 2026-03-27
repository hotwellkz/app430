import type { ArchitecturalExtractorAdapter } from './extractorAdapter.js';
import { MockArchitecturalExtractorAdapter } from './mockExtractorAdapter.js';
import { OpenAiExtractorAdapter } from './openaiExtractorAdapter.js';

export function resolveExtractorAdapter(
  src: NodeJS.ProcessEnv = process.env
): ArchitecturalExtractorAdapter {
  const mode = (src.IMPORT_EXTRACTOR_MODE ?? 'mock').trim().toLowerCase();
  if (mode === 'openai') {
    const apiKey = src.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('IMPORT_EXTRACTOR_MODE=openai requires OPENAI_API_KEY to be set');
    }
    return new OpenAiExtractorAdapter(apiKey);
  }
  // Default / unknown modes fallback to mock to keep pipeline deterministic.
  return new MockArchitecturalExtractorAdapter();
}
