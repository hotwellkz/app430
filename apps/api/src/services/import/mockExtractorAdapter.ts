import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import type {
  ArchitecturalExtractionInput,
  ArchitecturalExtractorAdapter,
} from './extractorAdapter.js';

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
        label: 'Floor 1 (mock)',
        elevationHintMm: null,
        confidence: {
          score: 0.2,
          level: 'low',
        },
      },
    ],
    outerContour: null,
    walls: [
      {
        id: 'mock-wall-internal-1',
        floorId: 'floor-1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        typeHint: 'internal',
        thicknessHintMm: 200,
      },
    ],
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
