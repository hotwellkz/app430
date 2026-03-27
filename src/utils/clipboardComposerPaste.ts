/**
 * Извлечение изображений из clipboard для поля ввода чата (Ctrl/Cmd+V).
 * Без глобальных слушателей — только обработка paste в composer.
 */

export const SUPPORTED_CLIPBOARD_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export function isSupportedClipboardImageMime(mime: string): boolean {
  const t = mime.toLowerCase().trim();
  if (SUPPORTED_CLIPBOARD_IMAGE_MIMES.has(t)) return true;
  return t === 'image/pjpeg' || t === 'image/x-png';
}

export interface ClipboardImageExtraction {
  /** Готовые файлы изображений (ещё без переименования) */
  imageFiles: File[];
  /** text/plain из clipboard (может быть пустым) */
  plainText: string;
  /** Были file-items, которые мы намеренно не берём (неподдерживаемый image/* или не-картинка) */
  hadUnsupportedOrNonImageFile: boolean;
}

type MinimalClipboard = {
  items: DataTransferItemList | undefined;
  files: FileList | undefined;
  getData: (type: string) => string;
};

/**
 * Читает items + files. Не трогает text/html — это отдельно (data URL).
 */
export function extractClipboardImagesFromDataTransfer(
  clipboardData: MinimalClipboard | null | undefined
): ClipboardImageExtraction {
  const plainText = clipboardData?.getData('text/plain') ?? '';
  const imageFiles: File[] = [];
  let hadUnsupportedOrNonImageFile = false;

  const items = clipboardData?.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (!f) continue;
      if (f.type.startsWith('image/')) {
        if (isSupportedClipboardImageMime(f.type)) {
          imageFiles.push(f);
        } else {
          hadUnsupportedOrNonImageFile = true;
        }
      } else {
        hadUnsupportedOrNonImageFile = true;
      }
    }
  }

  if (imageFiles.length === 0 && clipboardData?.files?.length) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f.type.startsWith('image/') && isSupportedClipboardImageMime(f.type)) {
        imageFiles.push(f);
      }
    }
  }

  return { imageFiles, plainText, hadUnsupportedOrNonImageFile };
}

/**
 * Извлекает встроенные data:image/...;base64 из HTML (например, копирование с сайта).
 * Внешние URL не загружаем.
 */
export function extractDataUrlImageFilesFromHtml(html: string, maxBytesPerImage = 15 * 1024 * 1024): File[] {
  if (!html || !html.includes('data:image')) return [];
  const out: File[] = [];
  const re = /src\s*=\s*["'](data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+)["']/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    const file = dataUrlToImageFile(m[1], idx++, maxBytesPerImage);
    if (file) out.push(file);
  }
  return out;
}

export function dataUrlToImageFile(
  dataUrl: string,
  index: number,
  maxBytes = 15 * 1024 * 1024
): File | null {
  const match = /^data:(image\/png|image\/jpeg|image\/jpg|image\/webp|image\/gif);base64,(.+)$/i.exec(
    dataUrl.replace(/\s/g, '')
  );
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  if (!isSupportedClipboardImageMime(mime)) return null;
  try {
    const b64 = match[2];
    const binary = atob(b64);
    if (binary.length > maxBytes) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
    return new File([bytes], `clipboard-html-${Date.now()}-${index}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

/** Имя для «безымянных» blob-файлов из буфера */
export function normalizeClipboardImageFileName(file: File, index: number): File {
  const hasUsefulName = Boolean(
    file.name &&
      !/^image\.(png|jpe?g|webp|gif)$/i.test(file.name) &&
      file.name !== 'blob' &&
      file.name.length > 1
  );
  if (hasUsefulName) return file;
  const mime = file.type.toLowerCase();
  const ext =
    mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  return new File([file], `clipboard-${Date.now()}-${index}.${ext}`, { type: file.type || mime });
}
