import type { ArchitecturalExtractorAdapter } from './extractorAdapter.js';
import { MockArchitecturalExtractorAdapter } from './mockExtractorAdapter.js';

export function resolveExtractorAdapter(
  src: NodeJS.ProcessEnv = process.env
): ArchitecturalExtractorAdapter {
  const mode = (src.IMPORT_EXTRACTOR_MODE ?? 'mock').trim().toLowerCase();
  if (mode === 'mock' || mode.length === 0) {
    return new MockArchitecturalExtractorAdapter();
  }
  // Unknown modes fallback to mock to keep pipeline deterministic in MVP.
  return new MockArchitecturalExtractorAdapter();
}
