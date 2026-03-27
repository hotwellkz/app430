/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AttachmentViewerModal } from './AttachmentViewerModal';

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('AttachmentViewerModal', () => {
  beforeEach(() => {
    document.body.classList.remove('attachment-preview-open');
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
      ResizeObserverMock;
  });

  it('показывает кнопку закрытия в preview', () => {
    render(
      <AttachmentViewerModal
        isOpen
        onClose={vi.fn()}
        url="https://example.com/r.jpg"
        type="image/jpeg"
        name="r.jpg"
      />
    );
    expect(screen.getByTestId('attachment-preview-close')).toBeTruthy();
  });

  it('закрывается по кнопке и вызывает onClose', () => {
    const onClose = vi.fn();
    render(
      <AttachmentViewerModal
        isOpen
        onClose={onClose}
        url="https://example.com/r.jpg"
        type="image/jpeg"
        name="r.jpg"
      />
    );
    fireEvent.click(screen.getByTestId('attachment-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ставит body class пока открыт', () => {
    const { rerender } = render(
      <AttachmentViewerModal
        isOpen
        onClose={vi.fn()}
        url="https://example.com/r.jpg"
        type="image/jpeg"
        name="r.jpg"
      />
    );
    expect(document.body.classList.contains('attachment-preview-open')).toBe(true);
    rerender(
      <AttachmentViewerModal
        isOpen={false}
        onClose={vi.fn()}
        url="https://example.com/r.jpg"
        type="image/jpeg"
        name="r.jpg"
      />
    );
    expect(document.body.classList.contains('attachment-preview-open')).toBe(false);
  });
});

