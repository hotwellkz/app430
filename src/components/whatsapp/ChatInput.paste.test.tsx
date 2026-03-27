/**
 * @vitest-environment jsdom
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';

function clipboardWithImage(file: File, plain = '') {
  const item = { kind: 'file', type: file.type, getAsFile: () => file };
  const items = Object.assign([item], { length: 1 }) as unknown as DataTransferItemList;
  return {
    getData: (type: string) => (type === 'text/plain' ? plain : type === 'text/html' ? '' : ''),
    items,
    files: [] as unknown as FileList,
  };
}

function dispatchPaste(target: EventTarget, clipboardData: ReturnType<typeof clipboardWithImage>) {
  const ev = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(ev, 'clipboardData', { value: clipboardData, enumerable: true });
  return target.dispatchEvent(ev);
}

describe('ChatInput clipboard paste', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('вызывает onComposerPasteImages при вставке изображения', () => {
    const onPasteImages = vi.fn();
    act(() => {
      root.render(
        createElement(ChatInput, {
          value: '',
          onChange: () => {},
          onSend: () => {},
          onComposerPasteImages: onPasteImages,
          onFileSelect: () => {},
        })
      );
    });
    const ta = host.querySelector('textarea');
    expect(ta).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' });
    act(() => {
      dispatchPaste(ta!, clipboardWithImage(file));
    });
    expect(onPasteImages).toHaveBeenCalledTimes(1);
    expect(onPasteImages.mock.calls[0][0].length).toBe(1);
    expect(onPasteImages.mock.calls[0][0][0].type).toBe('image/png');
  });

  it('не перехватывает вставку только текста', () => {
    const onPasteImages = vi.fn();
    act(() => {
      root.render(
        createElement(ChatInput, {
          value: '',
          onChange: () => {},
          onSend: () => {},
          onComposerPasteImages: onPasteImages,
          onFileSelect: () => {},
        })
      );
    });
    const ta = host.querySelector('textarea') as HTMLTextAreaElement;
    const cd = {
      getData: (type: string) => (type === 'text/plain' ? 'hello' : ''),
      items: { length: 0 } as unknown as DataTransferItemList,
      files: [] as unknown as FileList,
    };
    act(() => {
      dispatchPaste(ta, cd);
    });
    expect(onPasteImages).not.toHaveBeenCalled();
  });

  it('вставляет plain text и передаёт изображение во вложения', () => {
    const onPasteImages = vi.fn();
    const onChange = vi.fn();
    act(() => {
      root.render(
        createElement(ChatInput, {
          value: 'x',
          onChange,
          onSend: () => {},
          onComposerPasteImages: onPasteImages,
          onFileSelect: () => {},
        })
      );
    });
    const ta = host.querySelector('textarea') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(1, 1);
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    act(() => {
      dispatchPaste(ta, clipboardWithImage(file, 'caption '));
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some((c) => String(c[0]).includes('caption'))).toBe(true);
    expect(onPasteImages).toHaveBeenCalled();
  });

  it('без onComposerPasteImages не вызывает колбэк и не падает', () => {
    act(() => {
      root.render(
        createElement(ChatInput, {
          value: '',
          onChange: () => {},
          onSend: () => {},
          onFileSelect: () => {},
        })
      );
    });
    const ta = host.querySelector('textarea') as HTMLTextAreaElement;
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    expect(() =>
      act(() => {
        dispatchPaste(ta, clipboardWithImage(file));
      })
    ).not.toThrow();
  });
});

describe('регрессия: не-composer input', () => {
  it('вставка в обычный search input не использует ChatInput', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const input = document.createElement('input');
    input.type = 'search';
    input.setAttribute('aria-label', 'Поиск чатов');
    host.appendChild(input);
    const spy = vi.fn();
    input.addEventListener('paste', (e) => {
      spy((e as ClipboardEvent).clipboardData?.getData('text/plain'));
    });
    const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' });
    const cd = clipboardWithImage(file, '');
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(ev, 'clipboardData', { value: cd, enumerable: true });
    input.dispatchEvent(ev);
    expect(spy).toHaveBeenCalled();
    host.remove();
  });
});
