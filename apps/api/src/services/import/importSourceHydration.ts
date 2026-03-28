import type { ImportAssetRef } from '@2wix/shared-types';
import { getStorageBucket } from '../../firestore/admin.js';

const PREFIX = 'sip-import-sources';

export function assertImportStoragePathForProject(storagePath: string, projectId: string): void {
  const expected = `${PREFIX}/${projectId}/`;
  if (!storagePath.startsWith(expected)) {
    throw new Error(
      `Недопустимый storagePath для проекта: ${storagePath} (ожидался префикс ${expected})`
    );
  }
}

/**
 * Загружает байты из Firebase Storage и подставляет base64Data для extractor.
 * Если base64Data уже есть — не трогает (legacy create-import).
 */
export async function hydrateImportAssetsForExtraction(
  projectId: string,
  sourceImages: ImportAssetRef[]
): Promise<ImportAssetRef[]> {
  const out: ImportAssetRef[] = [];
  /** Ленивая инициализация — legacy path с base64 не трогает Storage. */
  let bucket: ReturnType<typeof getStorageBucket> | null = null;
  const ensureBucket = () => {
    if (!bucket) bucket = getStorageBucket();
    return bucket;
  };

  for (const img of sourceImages) {
    if (typeof img.base64Data === 'string' && img.base64Data.length > 0) {
      out.push(img);
      continue;
    }
    if (img.storageProvider === 'firebase' && img.storagePath) {
      const b = ensureBucket();
      const bucketName = b.name;
      assertImportStoragePathForProject(img.storagePath, projectId);
      const file = b.file(img.storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(
          `Исходник импорта не найден в storage (${img.storagePath}). Загрузите файл снова.`
        );
      }
      const [buf] = await file.download();
      out.push({
        ...img,
        bucket: img.bucket ?? bucketName,
        sizeBytes: img.sizeBytes ?? buf.length,
        base64Data: buf.toString('base64'),
      });
      continue;
    }
    throw new Error(
      'Импорт: для изображения нет ни base64Data, ни валидного storage ref (firebase + storagePath).'
    );
  }
  return out;
}
