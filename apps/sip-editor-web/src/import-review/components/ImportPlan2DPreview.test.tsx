import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import { ImportPlan2DPreview } from './ImportPlan2DPreview';

describe('ImportPlan2DPreview', () => {
  it('renders svg when snapshot has geometry', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      outerContour: {
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 5000, y: 0 },
          { x: 5000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
      walls: [
        {
          id: 'w1',
          floorId: 'f1',
          points: [
            { x: 2000, y: 0 },
            { x: 2000, y: 4000 },
          ],
          typeHint: 'internal',
        },
      ],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    render(<ImportPlan2DPreview rawSnapshot={snap} candidateModel={null} />);
    expect(screen.getByTestId('import-plan-2d-preview').querySelector('svg')).toBeTruthy();
  });

  it('renders empty state when no coordinates', () => {
    const snap: ArchitecturalImportSnapshot = {
      projectMeta: {},
      floors: [{ id: 'f1' }],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    };
    render(<ImportPlan2DPreview rawSnapshot={snap} candidateModel={null} />);
    expect(screen.getByText(/Нет координат/)).toBeTruthy();
  });
});
