/**
 * Smoke-тест Шага 1 модуля Kaspi.
 *
 * Использование:
 *   pnpm --filter @2wix/api run kaspi:smoke -- --company=<companyId>
 *
 * Что делает:
 * 1) Проверяет, что KASPI_TOKEN_ENCRYPTION_KEY настроен (AES-GCM).
 * 2) Создаёт/получает kaspiSettings для companyId с автогенерацией
 *    xmlEndpointSecret.
 * 3) Сохраняет тестовый Kaspi API-token зашифрованным и тут же дешифрует —
 *    проверяет, что цикл шифрования рабочий.
 * 4) Создаёт тестовый kaspiProduct.
 * 5) Добавляет один снапшот конкурента (subcollection).
 * 6) Добавляет запись в priceHistory (subcollection).
 * 7) Создаёт parseJob.
 * 8) Печатает результат и завершает процесс.
 *
 * Скрипт идемпотентный по settings (повторный запуск не дублирует),
 * но создаёт новые product/competitor/history/job на каждом запуске —
 * чтобы быстро увидеть, что записи реально создаются.
 */

// Side-effect import: грузит apps/api/.env независимо от cwd.
import '../loadEnv.js';

import {
  addCompetitorSnapshot,
  addPriceHistoryEntry,
  assertEncryptionKeyConfigured,
  createKaspiProduct,
  createParseJob,
  decryptToken,
  encryptToken,
  getKaspiApiToken,
  getOrCreateKaspiSettings,
  setKaspiApiToken,
} from '../firestore/kaspi/index.js';

function parseCompanyId(): string {
  const fromArg = (process.argv as string[])
    .find((a: string) => a.startsWith('--company='))
    ?.split('=')[1];
  const fromEnv = process.env.KASPI_SMOKE_COMPANY_ID;
  const result = fromArg || fromEnv;
  if (!result) {
    throw new Error(
      'Не задан companyId. Передайте --company=<id> или установите KASPI_SMOKE_COMPANY_ID',
    );
  }
  return result;
}

async function main(): Promise<void> {
  const companyId = parseCompanyId();
  console.log(`[kaspi/smoke] companyId=${companyId}`);

  console.log('[kaspi/smoke] 1) crypto key check ...');
  assertEncryptionKeyConfigured();
  const roundtrip = decryptToken(encryptToken('hello-kaspi'));
  if (roundtrip !== 'hello-kaspi') {
    throw new Error('crypto roundtrip failed');
  }
  console.log('   ok (encrypt → decrypt = "hello-kaspi")');

  console.log('[kaspi/smoke] 2) settings (auto-create) ...');
  const settings = await getOrCreateKaspiSettings(companyId);
  console.log(
    `   xmlEndpointSecret=${settings.xmlEndpointSecret.slice(0, 8)}... parseIntervalMinutes=${settings.parseIntervalMinutes}`,
  );

  console.log('[kaspi/smoke] 3) save & read encrypted token ...');
  await setKaspiApiToken(companyId, 'DUMMY-KASPI-TOKEN-FOR-SMOKE');
  const back = await getKaspiApiToken(companyId);
  if (back !== 'DUMMY-KASPI-TOKEN-FOR-SMOKE') {
    throw new Error(`token roundtrip mismatch: ${back}`);
  }
  console.log('   ok (encrypted in Firestore, decrypted back)');

  console.log('[kaspi/smoke] 4) create test product ...');
  const product = await createKaspiProduct({
    companyId,
    sku: `SMOKE-${Date.now()}`,
    name: 'Тестовый товар (smoke)',
    brand: 'HotWell.KZ',
    kaspiProductUrl: 'https://kaspi.kz/shop/p/smoke-test-12345/',
    kaspiProductSlug: 'smoke-test-12345',
    currentPrice: 1000,
    minPrice: 900,
    maxPrice: 1500,
  });
  console.log(`   productId=${product.id}`);

  console.log('[kaspi/smoke] 5) add competitor snapshot ...');
  const snap = await addCompetitorSnapshot({
    productId: product.id,
    companyId,
    merchantName: 'TestMerchant',
    merchantKaspiId: '999999',
    price: 950,
    city: 'Алматы',
    deliveryDays: 1,
    rating: 4.7,
  });
  console.log(`   snapshotId=${snap.id}`);

  console.log('[kaspi/smoke] 6) add price history entry ...');
  const hist = await addPriceHistoryEntry({
    productId: product.id,
    companyId,
    oldPrice: 1000,
    newPrice: 949,
    reason: 'smoke: TestMerchant=950 → undercut by 1',
    triggeredByCompetitorId: snap.id,
  });
  console.log(`   historyId=${hist.id}`);

  console.log('[kaspi/smoke] 7) create parse job ...');
  const job = await createParseJob({
    productId: product.id,
    companyId,
  });
  console.log(`   jobId=${job.id} status=${job.status}`);

  console.log('[kaspi/smoke] DONE');
  console.log(
    `   ▶ В Firestore Console посмотри: kaspiSettings/${companyId}, kaspiProducts/${product.id}, kaspiParseJobs/${job.id}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[kaspi/smoke] FAILED');
    console.error(err);
    process.exit(1);
  });
