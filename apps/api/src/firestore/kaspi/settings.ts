import { randomBytes } from 'node:crypto';
import type { KaspiSettings } from '@2wix/shared-types';
import { settingsDoc } from './collections.js';
import { decryptToken, encryptToken } from './crypto.js';

const DEFAULT_PARSE_INTERVAL_MINUTES = 10;
const DEFAULT_MIN_MARGIN_PERCENT = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function genSecret(): string {
  return randomBytes(16).toString('hex'); // 32 hex chars
}

/**
 * Получить настройки для компании. Если документа нет — создаём с дефолтами
 * и сгенерированным xmlEndpointSecret.
 */
export async function getOrCreateKaspiSettings(
  companyId: string,
): Promise<KaspiSettings> {
  const ref = settingsDoc(companyId);
  const snap = await ref.get();
  if (snap.exists) {
    return snap.data() as KaspiSettings;
  }

  const ts = nowIso();
  const fresh: KaspiSettings = {
    companyId,
    kaspiMerchantId: '',
    kaspiApiTokenEncrypted: null,
    xmlEndpointSecret: genSecret(),
    defaultMinMarginPercent: DEFAULT_MIN_MARGIN_PERCENT,
    parseIntervalMinutes: DEFAULT_PARSE_INTERVAL_MINUTES,
    lastKaspiFetchAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set(fresh);
  return fresh;
}

/** Обновить настройки (без перезаписи токена — для этого setKaspiApiToken). */
export async function updateKaspiSettings(
  companyId: string,
  patch: Partial<
    Pick<
      KaspiSettings,
      | 'kaspiMerchantId'
      | 'defaultMinMarginPercent'
      | 'parseIntervalMinutes'
      | 'lastKaspiFetchAt'
    >
  >,
): Promise<KaspiSettings> {
  const ref = settingsDoc(companyId);
  // Гарантируем, что документ существует (с secret).
  await getOrCreateKaspiSettings(companyId);
  await ref.update({ ...patch, updatedAt: nowIso() });
  const snap = await ref.get();
  return snap.data() as KaspiSettings;
}

/** Сохранить Kaspi API-token (шифруется AES-GCM перед записью). */
export async function setKaspiApiToken(
  companyId: string,
  plaintextToken: string | null,
): Promise<void> {
  await getOrCreateKaspiSettings(companyId);
  const encrypted = plaintextToken ? encryptToken(plaintextToken) : null;
  await settingsDoc(companyId).update({
    kaspiApiTokenEncrypted: encrypted,
    updatedAt: nowIso(),
  });
}

/** Прочитать дешифрованный токен (или null, если не задан). */
export async function getKaspiApiToken(
  companyId: string,
): Promise<string | null> {
  const settings = await getOrCreateKaspiSettings(companyId);
  if (!settings.kaspiApiTokenEncrypted) return null;
  return decryptToken(settings.kaspiApiTokenEncrypted);
}

/** Ротация xmlEndpointSecret (для кейса «утёк URL»). */
export async function rotateXmlEndpointSecret(
  companyId: string,
): Promise<string> {
  await getOrCreateKaspiSettings(companyId);
  const next = genSecret();
  await settingsDoc(companyId).update({
    xmlEndpointSecret: next,
    updatedAt: nowIso(),
  });
  return next;
}
