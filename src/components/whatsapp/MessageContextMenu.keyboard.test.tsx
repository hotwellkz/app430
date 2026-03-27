/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import MessageContextMenu from './MessageContextMenu';

function baseProps() {
  return {
    x: 10,
    y: 10,
    onClose: vi.fn(),
    onReply: vi.fn(),
    onForward: vi.fn(),
    onCopy: vi.fn(),
    onStar: vi.fn(),
    onDelete: vi.fn(),
    hasText: true,
  };
}

describe('MessageContextMenu keyboard guard', () => {
  it('does not react to global keydown when target is editable', () => {
    const props = baseProps();
    render(<MessageContextMenu {...props} />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const backspace = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(backspace);
    expect(backspace.defaultPrevented).toBe(false);

    const ctrlA = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(ctrlA);
    expect(ctrlA.defaultPrevented).toBe(false);

    const esc = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(esc);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('still handles Escape outside editable elements', () => {
    const props = baseProps();
    render(<MessageContextMenu {...props} />);

    const esc = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(esc);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

