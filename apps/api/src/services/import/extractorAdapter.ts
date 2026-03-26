import type {
  ArchitecturalImportSnapshot,
  ImportAssetRef,
} from '@2wix/shared-types';

export interface ArchitecturalExtractionInput {
  projectId: string;
  jobId: string;
  sourceImages: ImportAssetRef[];
  projectName?: string;
}

export interface ArchitecturalExtractorAdapter {
  readonly mode: 'mock';
  extractArchitecturalSnapshot(
    input: ArchitecturalExtractionInput
  ): Promise<ArchitecturalImportSnapshot>;
}
