# Модуль «Демпинг цен Kaspi» — Шаг 1: БД и типы

Хранилище: Firestore (мультитенант, поле `companyId` во всех документах).
Запись — только из Admin SDK (этого `apps/api`); фронт читает (rules
проверяют принадлежность к компании).

## Коллекции

- `kaspiSettings/{companyId}` — настройки магазина (один документ на компанию).
- `kaspiProducts/{productId}` — товары под автодемпингом.
  - `competitors/{snapshotId}` — снапшоты цен конкурентов (subcollection).
  - `priceHistory/{entryId}` — история изменений нашей цены (subcollection).
- `kaspiExcludedMerchants/{id}` — чёрный список магазинов.
- `kaspiParseJobs/{jobId}` — очередь задач парсинга.

Типы — в `@2wix/shared-types` (файл `src/kaspi.ts`).

## CRUD-сервисы

Каждая коллекция — отдельный файл (без бизнес-логики):

- `settings.ts` — `getOrCreateKaspiSettings`, `updateKaspiSettings`,
  `setKaspiApiToken` (AES-GCM-шифрует), `getKaspiApiToken` (дешифрует),
  `rotateXmlEndpointSecret`.
- `products.ts` — CRUD + список с пагинацией.
- `competitors.ts` — добавить снапшот, прочитать последние/за N минут.
- `excludedMerchants.ts` — добавить/удалить/список, утилита-Set для репрайсера.
- `priceHistory.ts` — добавить запись, последние N.
- `parseJobs.ts` — создать, обновить, выбрать pending.

Утилита `crypto.ts` — AES-256-GCM для `kaspiApiTokenEncrypted`.
Ключ читается из `KASPI_TOKEN_ENCRYPTION_KEY` (.env, base64, 32 байта).

## ENV

В `apps/api/.env` нужно положить:

```env
KASPI_TOKEN_ENCRYPTION_KEY=<base64, 32 байта>
# (генерация: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")

# Для шагов 4+:
KASPI_SMARTPROXY_USER=
KASPI_SMARTPROXY_PASS=
KASPI_SMARTPROXY_HOST=

# Для smoke:
KASPI_SMOKE_COMPANY_ID=<id вашей компании в CRM>
```

## Smoke-тест

```bash
pnpm --filter @2wix/api install   # один раз
pnpm --filter @2wix/api run kaspi:smoke -- --company=<companyId>
```

Скрипт:
1. Проверяет ключ шифрования (round-trip encrypt/decrypt).
2. Создаёт `kaspiSettings/<companyId>` с автогенерацией `xmlEndpointSecret`.
3. Шифрует/дешифрует тестовый Kaspi API-token.
4. Создаёт тестовый `kaspiProduct`, снапшот конкурента, запись `priceHistory`,
   `parseJob`.

Идемпотентен по `settings`. Каждый запуск создаёт новый product/snapshot/job.

## Acceptance criteria Шага 1

- ✅ `firebase.json` правила (`firestore.rules`) дополнены блоком `kaspi*`:
  чтение — для пользователей компании, запись — только Admin SDK.
- ✅ `firestore.indexes.json` дополнен 6 composite-индексами.
- ✅ TypeScript типы в `@2wix/shared-types`.
- ✅ CRUD-сервисы в `apps/api/src/firestore/kaspi/`.
- ✅ Smoke-команда: `pnpm --filter @2wix/api run kaspi:smoke -- --company=...`
- ⏳ Деплой rules: `pnpm run deploy:firestore-rules`
  (потребуется после слияния).

## Что НЕ сделано в Шаге 1 (это следующие шаги)

- API-роуты `/api/kaspi/*` — Шаг 3 (UI + REST).
- XML-endpoint `/api/kaspi/price/<secret>.xml` — Шаг 2.
- UI «Демпинг» в CRM — Шаг 3.
- Парсер карточек Kaspi — Шаг 4.
- Движок репрайсинга — Шаг 5.
- Telegram-алерты — Шаг 7.
