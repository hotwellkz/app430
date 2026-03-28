# Локальная разработка: CRM + SIP API + SIP Editor

Цель — полный happy path **без** деплоя в Cloud Run / Netlify: API на машине, CRM и редактор на Vite, запросы к API через прокси или прямой `/api` на редакторе.

## Порты (по умолчанию)

| Сервис | URL | Команда |
|--------|-----|---------|
| Fastify SIP API | `http://127.0.0.1:3001` | `pnpm dev:api` |
| CRM (корень монорепо) | `http://localhost:5173` | `pnpm dev` или `pnpm dev:crm` |
| SIP Editor | `http://localhost:5174` | `pnpm dev:sip-editor` |

Проверка API: `curl -sS http://127.0.0.1:3001/health | jq .`

## Готовые env-файлы (без ручного копирования)

Один раз из корня (создаёт `.env.development.local`, `apps/api/.env`, `apps/sip-editor-web/.env.development.local`, **только если файлов ещё нет**):

```bash
pnpm sip:scaffold-env
```

Уже созданные файлы скрипт **не перезаписывает**.

**Доступ API к Firestore (один раз на машине):** выполните `pnpm sip:adc` (`gcloud auth application-default login`). В `apps/api/.env` по умолчанию **`FIREBASE_PROJECT_ID=hotwell-crm`** — тот же GCP-проект, что у деплоя SIP API в Cloud Run; квота ADC после `sip:adc` обычно тоже `hotwell-crm`. Если раньше стоял `accounting-c3c06`, при ADC с доступом только к `hotwell-crm` Firestore давал `PERMISSION_DENIED` — это ожидаемо.

**Netlify Functions без `netlify dev`:** запросы к `/.netlify/functions/openai-integration` обрабатывает заглушка в `vite.config.ts` (нет спама 500 в консоль). Полные функции — `pnpm dev:full`.

Альтернатива ADC: положить JSON-ключ и указать `GOOGLE_APPLICATION_CREDENTIALS` или `FIREBASE_SERVICE_ACCOUNT_JSON` в `apps/api/.env`.

### Firestore: 503 или «PERMISSION_DENIED» (gRPC 7)

Учётная запись Google после `pnpm sip:adc` должна иметь право читать/писать Firestore в проекте **`FIREBASE_PROJECT_ID`** (сейчас обычно `hotwell-crm`). Выдайте себе роль (один раз, подставьте свой email):

```bash
gcloud projects add-iam-policy-binding hotwell-crm \
  --member="user:ВАШ_EMAIL@gmail.com" \
  --role="roles/datastore.user"
```

Либо в [IAM Console](https://console.cloud.google.com/iam-admin/iam) для проекта `hotwell-crm` добавьте роль **Cloud Datastore User** (или шире — **Firebase Admin** / **Owner** для своей учётки на время разработки).

После изменения IAM перезапустите `pnpm dev:api` (или `dev:sip-local`).

### Storage: «The specified bucket does not exist»

API читает `apps/api/.env` через `src/loadEnv.ts` (путь от файла), а не только из `process.cwd` — иначе при запуске из корня монорепо не подхватывался бы `FIREBASE_STORAGE_BUCKET`, и в коде использовался бы несуществующий дефолт `*.firebasestorage.app`.

Имя вида `PROJECT.firebasestorage.app` создаётся **только** при включении Firebase Storage в консоли Firebase (домен зарезервирован Google).

В репозитории для `hotwell-crm` в `apps/api/.env` задан отдельный GCS-бакет **`hotwell-crm-sip-imports`** (регион `europe-west3`). Его можно создать вручную:

`gcloud storage buckets create gs://hotwell-crm-sip-imports --project=hotwell-crm --location=europe-west3 --uniform-bucket-level-access`

И указать `FIREBASE_STORAGE_BUCKET=hotwell-crm-sip-imports`. Для Cloud Run задайте ту же переменную в env сервиса.

## Быстрый старт (всё сразу)

Из корня репозитория:

```bash
pnpm install
pnpm sip:scaffold-env      # при необходимости — локальные env
pnpm sip:local-preflight   # напоминание портов и env
pnpm dev:sip-local         # API + CRM + редактор параллельно
```

Откройте CRM → раздел SIP Projects → **Открыть** проект: должна открыться вкладка с **локальным** редактором (`http://localhost:5174/sip-editor/...`).

## Запуск по отдельности

**Только API**

```bash
pnpm dev:api
```

Рекомендуется скопировать `apps/api/.env.example` → `apps/api/.env` и при необходимости задать Firebase (`GOOGLE_APPLICATION_CREDENTIALS` или `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`). Для локального dev CORS по умолчанию уже включает `http://localhost:5173` и `http://localhost:5174` (см. `apps/api/src/config/env.ts`).

**Только CRM**

```bash
pnpm dev:crm
# или
pnpm dev
```

**Только SIP Editor**

```bash
pnpm dev:sip-editor
```

## Переменные окружения (локально)

### CRM (корень репозитория)

Файлы Vite: `.env.development.local` (приоритетнее `.env`) — см. [Vite env](https://vitejs.dev/guide/env-and-mode.html).

- **`VITE_SIP_API_BASE_URL`** — для локальной разработки задайте **`/sip-editor-api`**. Тогда браузер бьёт в тот же origin (`localhost:5173`), а `vite.config.ts` проксирует на `http://127.0.0.1:3001` (префикс снимается).
- **`VITE_SIP_EDITOR_ORIGIN`** — в **development**, если переменная **не задана** и CRM открыт с **localhost**, код в `src/lib/sip/sipEnv.ts` использует **`http://localhost:5174`** (редактор по умолчанию). Если в `.env` прописан production URL редактора — переопределите в **`.env.development.local`**, например:
  ```env
  VITE_SIP_EDITOR_ORIGIN=http://localhost:5174
  ```
  или удалите/закомментируйте переменную, чтобы сработал дефолт для localhost.

Пример фрагмента для локалки (можно вставить в `.env.development.local`):

```env
VITE_SIP_API_BASE_URL=/sip-editor-api
# VITE_SIP_EDITOR_ORIGIN не указываем — для localhost подставится :5174
```

### SIP Editor (`apps/sip-editor-web`)

- **`VITE_API_BASE_URL`** — для автономного dev **оставьте пустым**: запросы идут на `/api/...`, прокси в `apps/sip-editor-web/vite.config.ts` ведёт на `:3001`.
- Опционально **`VITE_CRM_ORIGIN=http://localhost:5173`** — для ссылок «назад в CRM» с guard-экранов.

Если нужен тот же префикс, что в Netlify: **`VITE_API_BASE_URL=/sip-editor-api`** — прокси `/sip-editor-api` → `:3001` (без CORS на API).

## Как убедиться, что не ушли в production

1. **Network** в DevTools: запросы к SIP API должны идти на `http://localhost:5173/sip-editor-api/...` (через прокси CRM) или на `http://localhost:5174/api/...` (автономный редактор), а не на `https://api.2wix.ru` / `*.run.app`.
2. URL вкладки редактора после «Открыть» — `http://localhost:5174/sip-editor/...`, а не Netlify/production origin.
3. `pnpm sip:local-preflight` выводит ожидаемые порты и env.

## Ограничения

- Нужны валидные **Firebase** credentials для API, если операции идут в реальный Firestore (как в проде). Без них часть маршрутов может отвечать ошибками — это ожидаемо для «чистой» машины без ключей.
- Netlify Functions (`/.netlify/functions/*`) в чистом `pnpm dev` не поднимаются; для них по-прежнему `pnpm dev:full` (отдельная тема, не SIP).

## Windows (PowerShell)

Те же команды из корня репозитория:

```powershell
pnpm install
pnpm dev:sip-local
```

Отдельные процессы — в разных окнах:

```powershell
pnpm dev:api
pnpm dev:crm
pnpm dev:sip-editor
```

Переменные для одной сессии PowerShell:

```powershell
$env:VITE_SIP_API_BASE_URL="/sip-editor-api"
pnpm dev:crm
```

## См. также

- Корневой `.env.example` — комментарии по SIP.
- `docs/cloud-run-deploy.md` — только для production deploy (локально не нужен).
