# Deploy Notes (SIP Editor stack)

## Required env

### CRM (root)
- `VITE_SIP_EDITOR_ORIGIN` — origin приложения редактора.
- `VITE_SIP_API_BASE_URL` — обычно `/sip-editor-api` (через proxy/redirect).
- `VITE_CRM_ORIGIN` (опционально) — для ссылок «назад в CRM».

### sip-editor-web
- `VITE_API_BASE_URL` — относительный `/api`/`/sip-editor-api` либо абсолютный URL API.
- `VITE_CRM_ORIGIN` (опционально) — origin CRM для guard links.

### apps/api
- `PORT` (default 3001)
- `CORS_ORIGINS`
- один из вариантов Firebase Admin:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - или `GOOGLE_APPLICATION_CREDENTIALS`
  - или `FIREBASE_PROJECT_ID` (минимально)

## Proxy expectations

- Dev (CRM vite): `/sip-editor-api` -> `http://127.0.0.1:3001`
- Prod (Netlify): redirect `/sip-editor-api/*` -> `https://api.2wix.ru/:splat`

Важно: redirect должен быть выше catch-all `/* /index.html 200`.

## Health checks

- `GET /health`
- `GET /health/details`

Используйте для быстрой диагностики до проверки UI.

Подробный incident runbook (prod, 5-10 минут): `docs/sip-api-ops-runbook.md`.

