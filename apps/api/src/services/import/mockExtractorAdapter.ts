import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import type {
  ArchitecturalExtractionInput,
  ArchitecturalExtractorAdapter,
} from './extractorAdapter.js';

/** Прямоугольный контур ~12×10 м (мм) — после normalize строится оболочка из 4 внешних сегментов. */
const MOCK_OUTER_RECT_MM: NonNullable<ArchitecturalImportSnapshot['outerContour']> = {
  kind: 'polygon',
  points: [
    { x: 0, y: 0 },
    { x: 12_000, y: 0 },
    { x: 12_000, y: 10_000 },
    { x: 0, y: 10_000 },
  ],
  confidence: { score: 0.35, level: 'low' },
};

export function createMockArchitecturalImportSnapshot(input?: {
  projectName?: string;
}): ArchitecturalImportSnapshot {
  return {
    projectMeta: {
      ...(input?.projectName ? { name: input.projectName } : {}),
      detectedScaleHints: [],
      notes: ['mock import snapshot generated without AI extractor'],
    },
    floors: [
      {
        id: 'floor-1',
        label: 'Floor 1',
        elevationHintMm: null,
        confidence: {
          score: 0.2,
          level: 'low',
        },
      },
    ],
    outerContour: MOCK_OUTER_RECT_MM,
    /** Пусто: normalize построит оболочку по outerContour только если после filter/refine нет сегментов (FOOTPRINT_SHELL_NO_AI_SEGMENTS). */
    walls: [],
    openings: [],
    stairs: [],
    roofHints: {
      likelyType: 'unknown',
      confidence: { score: 0.1, level: 'low' },
      notes: ['Extractor is not connected yet'],
    },
    dimensions: [],
    unresolved: [
      {
        id: 'mock-extractor-not-connected',
        code: 'EXTRACTOR_NOT_CONNECTED',
        severity: 'blocking',
        message: 'AI extractor not connected yet. Review/confirmation required.',
        requiredAction: 'Подключить extractor и выполнить импорт повторно',
        relatedIds: [],
      },
    ],
    notes: ['mock import snapshot generated without AI extractor'],
  };
}

export class MockArchitecturalExtractorAdapter implements ArchitecturalExtractorAdapter {
  readonly mode = 'mock' as const;

  async extractArchitecturalSnapshot(
    input: ArchitecturalExtractionInput
  ): Promise<ArchitecturalImportSnapshot> {
    return createMockArchitecturalImportSnapshot({
      projectName: input.projectName,
    });
  }
}
