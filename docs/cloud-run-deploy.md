# Cloud Run Deploy: SIP API

Документ описывает production-путь деплоя `apps/api` в Google Cloud Run без SSH/VPS как основного канала.

## 1) Архитектура (целевая)

- `Cloud Run service` (Node/Fastify API)
- `External HTTPS Load Balancer` перед Cloud Run (serverless NEG)
- `Managed SSL Certificate`
- `api.2wix.ru` -> HTTPS LB -> Cloud Run
- CRM использует `VITE_SIP_API_BASE_URL=https://api.2wix.ru` или same-origin proxy `/sip-editor-api` (по стратегии frontend)

`run.app` URL допустим как этап pre-cutover smoke.

## 2) Readiness summary

Сервис готов к Cloud Run с минимальными правками:

- слушает `0.0.0.0` и `process.env.PORT`;
- есть `GET /health` и `GET /health/details`;
- Firestore/Firebase Admin уже инициализируется без локального state;
- нет необходимости в persistent filesystem.

## 3) Обязательные env

Обычные:

- `NODE_ENV=production`
- `CORS_ORIGINS=https://2wix.ru,https://www.2wix.ru`
- `FIREBASE_PROJECT_ID=<gcp-project>` (рекомендуется явно)

Секреты (опционально):

- `FIREBASE_SERVICE_ACCOUNT_JSON` — **только если** не используете IAM attached service account.

Предпочтительный путь:

- не хранить JSON-ключ в repo;
- использовать Cloud Run attached service account + IAM доступ к Firestore;
- Secret Manager только как fallback.

## 4) Build + deploy (gcloud)

Быстрый скрипт:

- `scripts/deploy-sip-api-cloud-run.sh`

Пример:

```bash
chmod +x scripts/deploy-sip-api-cloud-run.sh
GCP_PROJECT_ID=<project-id> \
GCP_REGION=europe-west3 \
SIP_API_SERVICE_NAME=sip-editor-api \
CORS_ORIGINS=https://2wix.ru,https://www.2wix.ru \
FIREBASE_PROJECT_ID=<project-id> \
scripts/deploy-sip-api-cloud-run.sh
```

Smoke после deploy:

```bash
RUN_URL=$(gcloud run services describe sip-editor-api --region=europe-west3 --format='value(status.url)')
curl -i "$RUN_URL/health"
curl -i "$RUN_URL/health/details"
```

## 5) Рекомендация по custom domain

Для production рекомендуется:

1. Создать serverless NEG для Cloud Run service.
2. Подключить NEG к external HTTPS LB backend service.
3. Создать managed certificate для `api.2wix.ru`.
4. Привязать DNS `A/AAAA` (или CNAME по схеме LB) к frontend IP LB.
5. Проверить TLS + health через домен.

Почему так:

- контролируемый production ingress;
- предсказуемое SSL/маршрутизация;
- стабильнее, чем ad-hoc SSH/VPS path.

## 6) CRM switch

CRM читает SIP API base из `VITE_SIP_API_BASE_URL` через `src/lib/sip/sipEnv.ts`.

Рекомендуемый cutover:

1. До переключения CRM протестировать `run.app` endpoint.
2. После успешного smoke перевести `api.2wix.ru` на HTTPS LB.
3. Если CRM использует абсолютный base — обновить `VITE_SIP_API_BASE_URL`.
4. Если CRM использует `/sip-editor-api` proxy — обновить proxy upstream на новый домен.

## 7) Rollback

- вернуть DNS/LB backend на предыдущий рабочий API endpoint;
- откатить env `VITE_SIP_API_BASE_URL` при необходимости;
- сохранить Cloud Run service развернутым для повторного cutover.

## 8) Минимальный production checklist

1. `GET /health` не timeout.
2. `GET /health/details` возвращает валидный JSON.
3. `POST /api/projects` успешен с валидным `x-sip-user-id`.
4. Firestore операции create/read проходят.
5. CRM кнопка `Создать SIP-проект` успешна под реальным пользователем.
