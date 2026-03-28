import { createHash } from 'node:crypto';
import type { ImportAssetRef } from '@2wix/shared-types';
import type { FastifyRequest } from 'fastify';
import { InternalError, ValidationAppError } from '../../errors/httpErrors.js';
import { getStorageBucket } from '../../firestore/admin.js';

export const IMPORT_SOURCE_MAX_BYTES = 25 * 1024 * 1024;

const PREFIX = 'sip-import-sources';

/** Разбор multipart: file + поля id, kind. */
export async function parseImportSourceUploadRequest(request: FastifyRequest): Promise<{
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  assetId: string;
  kind: ImportAssetRef['kind'];
}> {
  let buffer: Buffer | null = null;
  let originalFileName = 'file';
  let mimeType = 'application/octet-stream';
  let assetId = '';
  let kind: ImportAssetRef['kind'] = 'plan';

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      buffer = await part.toBuffer();
      originalFileName = part.filename || 'file';
      mimeType = part.mimetype || mimeType;
    } else if (part.type === 'field') {
      const raw = part.value;
      const v = typeof raw === 'string' ? raw : String(raw ?? '');
      if (part.fieldname === 'id') assetId = v.trim();
      if (part.fieldname === 'kind') {
        const k = v.trim();
        if (k === 'plan' || k === 'facade' || k === 'other') kind = k;
      }
    }
  }

  if (!buffer) {
    throw new ValidationAppError('Файл не передан (ожидается multipart с полем file)');
  }
  if (!assetId) {
    throw new ValidationAppError('Поле id обязательно');
  }

  return { buffer, originalFileName, mimeType, assetId, kind };
}

function safeFileSegment(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 180);
  return base.length > 0 ? base : 'file.bin';
}

function isRasterMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (m === 'application/pdf') return false;
  return m.startsWith('image/');
}

export async function uploadImportRasterAndBuildRef(input: {
  projectId: string;
  assetId: string;
  kind: ImportAssetRef['kind'];
  originalFileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ImportAssetRef> {
  if (!input.assetId.trim()) {
    throw new ValidationAppError('Поле id обязательно');
  }
  if (!isRasterMime(input.mimeType)) {
    throw new ValidationAppError(
      'Допустимы только растровые изображения (image/*). PDF загрузите как изображение страницы.'
    );
  }
  if (input.buffer.byteLength === 0) {
    throw new ValidationAppError('Пустой файл');
  }
  if (input.buffer.byteLength > IMPORT_SOURCE_MAX_BYTES) {
    throw new ValidationAppError(
      `Файл слишком больший (макс. ${Math.floor(IMPORT_SOURCE_MAX_BYTES / 1024 / 1024)} МБ)`
    );
  }

  const bucket = getStorageBucket();
  const safeName = safeFileSegment(input.originalFileName);
  const storagePath = `${PREFIX}/${input.projectId}/${input.assetId}/${safeName}`;

  const file = bucket.file(storagePath);
  try {
    await file.save(input.buffer, {
      resumable: false,
      metadata: { contentType: input.mimeType },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new InternalError(
      `Не удалось сохранить файл в Storage (${msg}). Проверьте FIREBASE_STORAGE_BUCKET и права сервисного аккаунта на bucket.`
    );
  }

  const checksumSha256 = createHash('sha256').update(input.buffer).digest('hex');

  const ref: ImportAssetRef = {
    id: input.assetId,
    kind: input.kind,
    fileName: input.originalFileName || safeName,
    mimeType: input.mimeType,
    storageProvider: 'firebase',
    bucket: bucket.name,
    storagePath,
    sizeBytes: input.buffer.byteLength,
    checksumSha256,
  };
  return ref;
}
