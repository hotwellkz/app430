import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-GCM шифрование секретов модуля Kaspi (Kaspi API-token и др.).
 *
 * Ключ читается из переменной окружения KASPI_TOKEN_ENCRYPTION_KEY —
 * base64-закодированные 32 байта (256 бит). Сгенерировать новый можно так:
 *   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
 *
 * Формат шифротекста: JSON-строка { iv, tag, ciphertext } — все три поля
 * в base64. Этот JSON хранится в Firestore как одно строковое поле.
 */

const ALG = 'aes-256-gcm';
const IV_LEN = 12; // рекомендация для GCM
const TAG_LEN = 16;
const KEY_ENV = 'KASPI_TOKEN_ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) {
    throw new Error(
      `[kaspi/crypto] env ${KEY_ENV} is not set; cannot (en|de)crypt token`,
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `[kaspi/crypto] ${KEY_ENV} must decode to 32 bytes, got ${buf.length}`,
    );
  }
  cachedKey = buf;
  return buf;
}

/** Шифрует plaintext (UTF-8) → строка JSON для хранения в Firestore. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
  });
}

/** Дешифрует строку, ранее полученную из encryptToken. */
export function decryptToken(encoded: string): string {
  let payload: { iv: string; tag: string; ciphertext: string };
  try {
    payload = JSON.parse(encoded);
  } catch {
    throw new Error('[kaspi/crypto] invalid encrypted token payload (not JSON)');
  }
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('[kaspi/crypto] iv/tag length mismatch');
  }
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}

/** Только проверка, что ключ настроен. Используется в smoke-тестах. */
export function assertEncryptionKeyConfigured(): void {
  getKey();
}
