import type { CreateImportJobRequest, ImportAssetRef } from '@2wix/shared-types';
import type { WizardFileItem } from './importWizardTypes';

export type ImportAssetKind = 'plan' | 'facade' | 'other';

function newAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function fileToImportAssetRef(item: WizardFileItem): ImportAssetRef {
  const mime = item.file.type?.trim();
  return {
    id: newAssetId(),
    kind: item.kind,
    fileName: item.file.name || 'file',
    ...(mime ? { mimeType: mime } : {}),
  };
}

export function buildCreateImportJobRequest(
  items: WizardFileItem[],
  projectTitle?: string
): CreateImportJobRequest {
  const sourceImages = items.map(fileToImportAssetRef);
  const body: CreateImportJobRequest = { sourceImages };
  const name = projectTitle?.trim();
  if (name) body.projectName = name;
  return body;
}
