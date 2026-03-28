import type { CreateImportJobRequest, ImportAssetRef } from '@2wix/shared-types';
import { uploadImportSourceFile } from '@/api/projectsApi';
import type { WizardFileItem } from './importWizardTypes';

export type ImportAssetKind = 'plan' | 'facade' | 'other';

function newAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Returns base64-encoded file content (without data URL prefix), or null if reading fails. */
async function readFileAsBase64(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix — keep only the base64 payload.
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function guessMimeFromFileName(name: string): string | undefined {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
  };
  return map[ext];
}

function normalizeMimeType(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === 'image/jpg' || m === 'image/pjpeg') return 'image/jpeg';
  if (m === 'image/x-png') return 'image/png';
  return m;
}

/** Effective MIME for ImportAssetRef and encoding decisions (browser type or extension guess). */
export function resolveEffectiveMimeType(file: File): string | undefined {
  const raw = file.type?.trim();
  if (raw) return normalizeMimeType(raw);
  return guessMimeFromFileName(file.name);
}

/**
 * True if the file is treated as a raster (or other image/*) source for which we try to attach pixel data.
 * PDF and non-image types are false — AI vision path needs raster pixels in MVP.
 */
export function shouldAttemptPixelRead(file: File): boolean {
  const mime = resolveEffectiveMimeType(file);
  if (!mime) return false;
  if (mime === 'application/pdf') return false;
  return mime.startsWith('image/');
}

/**
 * Только растры (image/*) идут в POST /import-sources → Storage.
 * PDF и прочее — в теле create-import с base64 (см. backend uploadImportRasterAndBuildRef).
 */
export function shouldUploadImportSourceToStorage(file: File): boolean {
  const mime = resolveEffectiveMimeType(file);
  if (!mime) return false;
  if (mime === 'application/pdf') return false;
  return mime.startsWith('image/');
}

/** PDF / не-растр: ref с base64, без Storage (stable id = clientId). */
async function importAssetRefWithoutStorageUpload(item: WizardFileItem): Promise<ImportAssetRef> {
  const effectiveMime = resolveEffectiveMimeType(item.file);
  const ref: ImportAssetRef = {
    id: item.clientId,
    kind: item.kind,
    fileName: item.file.name || 'file',
    ...(effectiveMime ? { mimeType: effectiveMime } : {}),
  };
  if (effectiveMime === 'application/pdf') {
    const b64 = await readFileAsBase64(item.file);
    if (b64) ref.base64Data = b64;
    return ref;
  }
  if (shouldAttemptPixelRead(item.file)) {
    const b64 = await readFileAsBase64(item.file);
    if (b64) ref.base64Data = b64;
  }
  return ref;
}

export async function fileToImportAssetRef(item: WizardFileItem): Promise<ImportAssetRef> {
  const effectiveMime = resolveEffectiveMimeType(item.file);
  const ref: ImportAssetRef = {
    id: newAssetId(),
    kind: item.kind,
    fileName: item.file.name || 'file',
    ...(effectiveMime ? { mimeType: effectiveMime } : {}),
  };

  if (shouldAttemptPixelRead(item.file)) {
    const base64 = await readFileAsBase64(item.file);
    if (base64) ref.base64Data = base64;
  }

  return ref;
}

export async function buildCreateImportJobRequest(
  items: WizardFileItem[],
  projectTitle?: string
): Promise<CreateImportJobRequest> {
  const sourceImages = await Promise.all(items.map(fileToImportAssetRef));
  const body: CreateImportJobRequest = { sourceImages };
  const name = projectTitle?.trim();
  if (name) body.projectName = name;
  return body;
}

export type UploadImportSourceFn = typeof uploadImportSourceFile;

/**
 * Основной MVP-путь: файлы загружаются в Firebase Storage через API, в create-import уходят только refs (без base64).
 */
export async function buildCreateImportJobRequestWithUploads(
  projectId: string,
  items: WizardFileItem[],
  projectTitle: string | undefined,
  uploadOne: UploadImportSourceFn = uploadImportSourceFile
): Promise<CreateImportJobRequest> {
  const sourceImages: ImportAssetRef[] = [];
  for (const item of items) {
    if (shouldUploadImportSourceToStorage(item.file)) {
      const { asset } = await uploadOne(projectId, {
        file: item.file,
        id: item.clientId,
        kind: item.kind,
      });
      sourceImages.push(asset);
    } else {
      sourceImages.push(await importAssetRefWithoutStorageUpload(item));
    }
  }
  const body: CreateImportJobRequest = { sourceImages };
  const name = projectTitle?.trim();
  if (name) body.projectName = name;
  return body;
}
