# SIP API OPS Runbook (Prod Incident 5-10 min)

Этот runbook нужен для ситуации, когда в CRM на `2wix.ru` кнопка `Создать SIP-проект` падает с timeout/503/504.

Цель: быстро и точно локализовать проблему по слоям: `frontend -> proxy -> api.2wix.ru -> Fastify -> Firebase/Firestore`.

## 0) Симптом и expected flow

- Симптом: в CRM ошибка `SIP API не ответил вовремя...` или `SIP API недоступен`.
- Expected route:
  - CRM вызывает `POST /sip-editor-api/api/projects` на `2wix.ru`.
  - Netlify redirect проксирует на `https://api.2wix.ru/api/projects`.
  - Fastify route `POST /api/projects` создает проект в Firestore.

## 1) Быстрый smoke-test извне (1-2 минуты)

Запускаем с любой внешней машины:

```bash
curl -i --max-time 10 https://2wix.ru/sip-editor-api/health
curl -i --max-time 10 https://api.2wix.ru/health
curl -i --max-time 10 https://api.2wix.ru/health/details
```

Интерпретация:

- `2wix.ru ... timeout` и `api.2wix.ru ... timeout` -> проблема почти точно в backend/proxy runtime.
- `2wix.ru` отвечает, но `api.2wix.ru` timeout -> upstream/API.
- `2wix.ru` 404/HTML на `/sip-editor-api/*` -> ошибка redirect/rewrite.
- `health` отвечает `503` JSON -> сервис жив, но деградирован (смотри `checks/errors/requestId`).

## 2) Проверка Netlify proxy/rewrite (1 минута)

Проверьте, что правило есть и стоит выше catch-all:

- `public/_redirects`:
  - `/sip-editor-api/* https://api.2wix.ru/:splat 200`
  - и только потом `/* /index.html 200`

Быстрая валидация:

```bash
curl -i --max-time 10 https://2wix.ru/sip-editor-api/health
```

Если получаете HTML вместо JSON, redirect сломан или порядок правил неверный.

## 3) DNS/TLS/L4 проверка api.2wix.ru (1-2 минуты)

```bash
nslookup api.2wix.ru
curl -I --max-time 10 https://api.2wix.ru
openssl s_client -connect api.2wix.ru:443 -servername api.2wix.ru </dev/null
```

Сигналы:

- DNS не резолвится -> DNS/zone issue.
- TLS handshake не проходит -> сертификат/ingress/LB.
- TLS ок, но HTTP timeout -> процесс не слушает upstream или firewall/LB route.

## 4) Runtime на сервере API (2-3 минуты)

Ниже два распространенных сценария. Используйте ваш реальный.

### Вариант A: systemd

```bash
sudo systemctl status sip-editor-api --no-pager
sudo journalctl -u sip-editor-api -n 200 --no-pager
sudo ss -ltnp | rg ":3001|:443|:80"
```

Что ищем:

- service `inactive/failed/restarting`;
- crash loop при старте;
- нет listening на `PORT` (обычно `3001`);
- ошибки env/Firebase при boot.

### Вариант B: PM2

```bash
pm2 status
pm2 logs sip-editor-api --lines 200
ss -ltnp | rg ":3001|:443|:80"
```

Что ищем то же: падения, restart loop, отсутствие listen.

## 5) Reverse proxy (nginx) до Fastify (1-2 минуты)

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo tail -n 200 /var/log/nginx/error.log
sudo tail -n 200 /var/log/nginx/access.log
```

Проверьте:

- `proxy_pass` ведет на правильный upstream (`127.0.0.1:3001` или другой target);
- нет `connect() failed`, `upstream timed out`, `no live upstreams`;
- таймауты nginx не слишком малы;
- SSL server_name/cert соответствует `api.2wix.ru`.

## 6) Проверка API routes и CORS

`POST /api/projects` требует:

- header `x-sip-user-id`;
- JSON body (`title`, `dealId`, `createdBy`).

Smoke:

```bash
curl -i --max-time 10 -X POST "https://api.2wix.ru/api/projects" \
  -H "content-type: application/json" \
  -H "x-sip-user-id: smoke-user" \
  -d '{"title":"smoke","dealId":null,"createdBy":"smoke-user"}'
```

Если `401/403` -> runtime жив, проблема в auth/access.
Если `5xx` -> backend/service problem.
Если timeout -> infrastructure/runtime недоступен.

Примечание по CORS: для CRM используется same-origin proxy (`/sip-editor-api`), поэтому CORS не должен быть блокером для продового UI. CORS критичен при прямом вызове `api.2wix.ru` из браузера.

## 7) Firebase Admin / Firestore (если health=503)

Проверьте env:

- `FIREBASE_SERVICE_ACCOUNT_JSON` или `GOOGLE_APPLICATION_CREDENTIALS`;
- `FIREBASE_PROJECT_ID`;
- `NODE_ENV`, `PORT`, `CORS_ORIGINS`.

Проверьте ответ:

```bash
curl -s --max-time 10 https://api.2wix.ru/health/details
```

Смотрите поля:

- `checks.firebaseAdmin`
- `checks.firestorePing`
- `checks.collections`
- `diagnostics.errors[]`

## 8) Что считать корнем проблемы

- **Frontend issue**: только если URL/headers/body неверны в браузере при живом backend.
- **Proxy issue**: `2wix.ru/sip-editor-api/*` не доходит до `api.2wix.ru` (404/HTML/wrong rewrite).
- **Backend runtime issue**: `api.2wix.ru/health` timeout или 5xx.
- **Env/Firebase issue**: backend жив, но `/health` = 503 и ошибки в `diagnostics`.

## 9) Минимальный recovery checklist

1. Восстановить ответ `GET https://api.2wix.ru/health` (200 или диагностический 503, но не timeout).
2. Проверить `GET https://2wix.ru/sip-editor-api/health` -> корректный JSON.
3. Проверить `POST /api/projects` smoke-запросом.
4. Проверить в CRM кнопку `Создать SIP-проект` под реальным пользователем.
5. Зафиксировать `requestId` из ошибки/ответа и приложить в incident-log.

## 10) Полезные артефакты для инцидента

- timestamp инцидента (UTC);
- `requestId` из UI/API;
- вывод 3 команд:
  - `curl https://2wix.ru/sip-editor-api/health`
  - `curl https://api.2wix.ru/health`
  - `systemctl status`/`pm2 status` + последние логи.

Этого достаточно, чтобы в большинстве случаев локализовать падение за 5-10 минут.
