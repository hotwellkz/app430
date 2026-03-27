import type { CreateImportJobRequest, ImportAssetRef } from '@2wix/shared-types';
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

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export async function fileToImportAssetRef(item: WizardFileItem): Promise<ImportAssetRef> {
  const mime = item.file.type?.trim();
  const ref: ImportAssetRef = {
    id: newAssetId(),
    kind: item.kind,
    fileName: item.file.name || 'file',
    ...(mime ? { mimeType: mime } : {}),
  };

  // Only encode supported image formats — GPT-4o Vision does not accept PDFs directly.
  if (mime && SUPPORTED_IMAGE_TYPES.has(mime)) {
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
