import { describe, expect, it } from 'vitest';
import {
  extractClipboardImagesFromDataTransfer,
  extractDataUrlImageFilesFromHtml,
  isSupportedClipboardImageMime,
  normalizeClipboardImageFileName,
  dataUrlToImageFile,
} from '../clipboardComposerPaste';

function makeClipboardMock(parts: {
  items?: Array<{ kind: string; type: string; file: File | null }>;
  files?: File[];
  plain?: string;
  html?: string;
}) {
  const specs = parts.items ?? [];
  const itemObjects = specs.map((spec) => ({
    kind: spec.kind,
    type: spec.type,
    getAsFile: () => spec.file,
  }));
  const list = itemObjects as unknown as DataTransferItemList & Record<number, (typeof itemObjects)[0]>;
  (list as unknown as { length: number }).length = itemObjects.length;
  itemObjects.forEach((it, i) => {
    (list as unknown as Record<number, unknown>)[i] = it;
  });
  return {
    getData: (type: string) => {
      if (type === 'text/plain') return parts.plain ?? '';
      if (type === 'text/html') return parts.html ?? '';
      return '';
    },
    items: list,
    files: (parts.files ?? []) as unknown as FileList,
  };
}

describe('clipboardComposerPaste', () => {
  it('isSupportedClipboardImageMime accepts png/jpeg/webp/gif', () => {
    expect(isSupportedClipboardImageMime('image/png')).toBe(true);
    expect(isSupportedClipboardImageMime('image/jpeg')).toBe(true);
    expect(isSupportedClipboardImageMime('image/webp')).toBe(true);
    expect(isSupportedClipboardImageMime('image/gif')).toBe(true);
    expect(isSupportedClipboardImageMime('image/bmp')).toBe(false);
    expect(isSupportedClipboardImageMime('image/tiff')).toBe(false);
  });

  it('extractClipboardImagesFromDataTransfer returns files from items', () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    const dt = makeClipboardMock({
      items: [{ kind: 'file', type: 'image/png', file: png }],
      plain: '',
    });
    const r = extractClipboardImagesFromDataTransfer(dt);
    expect(r.imageFiles).toHaveLength(1);
    expect(r.imageFiles[0].name).toBe('shot.png');
    expect(r.plainText).toBe('');
  });

  it('text-only clipboard yields no image files', () => {
    const dt = makeClipboardMock({
      items: [{ kind: 'string', type: 'text/plain', file: null }],
      plain: 'hello',
    });
    const r = extractClipboardImagesFromDataTransfer(dt);
    expect(r.imageFiles).toHaveLength(0);
    expect(r.plainText).toBe('hello');
  });

  it('marks unsupported image types', () => {
    const bmp = new File([new Uint8Array([1])], 'x.bmp', { type: 'image/bmp' });
    const dt = makeClipboardMock({
      items: [{ kind: 'file', type: 'image/bmp', file: bmp }],
    });
    const r = extractClipboardImagesFromDataTransfer(dt);
    expect(r.imageFiles).toHaveLength(0);
    expect(r.hadUnsupportedOrNonImageFile).toBe(true);
  });

  it('normalizeClipboardImageFileName renames generic blob names', () => {
    const f = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' });
    const n = normalizeClipboardImageFileName(f, 0);
    expect(n.name).toMatch(/^clipboard-/);
    expect(n.name.endsWith('.png')).toBe(true);
  });

  it('extractDataUrlImageFilesFromHtml parses embedded png', () => {
    const tiny =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const html = `<div><img src="data:image/png;base64,${tiny}" /></div>`;
    const files = extractDataUrlImageFilesFromHtml(html);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0].type).toBe('image/png');
  });

  it('dataUrlToImageFile returns null for oversize base64', () => {
    const huge = 'a'.repeat(5000);
    const dataUrl = `data:image/png;base64,${btoa(huge)}`;
    const f = dataUrlToImageFile(dataUrl, 0, 100);
    expect(f).toBeNull();
  });
});
