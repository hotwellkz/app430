import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyBuildingModel, createFloor, createWall } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { Preview3DPanel } from './Preview3DPanel';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="mock-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: () => undefined }, lookAt: () => undefined },
  }),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  PerspectiveCamera: () => null,
}));

describe('Preview3DPanel', () => {
  it('рендерит empty state для пустой модели', () => {
    const model = createEmptyBuildingModel();
    render(<Preview3DPanel model={model} activeFloorId={null} layerVisibility={{}} />);
    expect(screen.getByText(/Пустая модель/i)).toBeTruthy();
  });

  it('показывает переключатели слоев и режим этажей', () => {
    useEditorStore.getState().reset();
    const model = createEmptyBuildingModel();
    const floor = createFloor({
      label: '1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    model.floors.push(floor);
    model.walls.push(
      createWall({
        floorId: floor.id,
        start: { x: 0, y: 0 },
        end: { x: 2000, y: 0 },
        thicknessMm: 200,
        wallType: 'external',
      })
    );
    render(<Preview3DPanel model={model} activeFloorId={floor.id} layerVisibility={{}} />);
    expect(screen.getByLabelText(/Стены/i)).toBeTruthy();
    expect(screen.getByLabelText(/Проёмы/i)).toBeTruthy();
    expect(screen.getByLabelText(/Перекрытия/i)).toBeTruthy();
    expect(screen.getByLabelText(/Крыша/i)).toBeTruthy();
    expect(screen.getByDisplayValue('all floors')).toBeTruthy();
  });
});
