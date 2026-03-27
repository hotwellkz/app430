/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { isEditableTarget } from './isEditableTarget';

describe('isEditableTarget', () => {
  it('returns true for input and textarea', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
  });

  it('returns true for contenteditable and nested elements', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editable.appendChild(nested);
    document.body.appendChild(editable);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(nested)).toBe(true);
  });

  it('returns false for non-editable targets', () => {
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

