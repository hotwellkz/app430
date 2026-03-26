import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('shows shell fallback when children crash', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary scope="shell">
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/Ошибка редактора/i)).toBeTruthy();
  });

  it('shows preview fallback when 3d crashes', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary scope="preview3d">
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/3D preview временно недоступен/i)).toBeTruthy();
  });
});

