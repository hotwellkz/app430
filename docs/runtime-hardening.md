# Runtime Hardening Notes

## Entry flow

CRM (`/sip-projects` или сделка) -> `buildSipEditorUrl(projectId, uid)` -> `sip-editor-web` -> API (`/sip-editor-api/api/projects*`) -> Firestore.

Ключевые условия:
- `projectId` в path;
- `sipUserId` в query или сохранён в session/local storage;
- валидный proxy route `/sip-editor-api/*`.

## API health

- `GET /health` — summary c `ok/checks/requestId`.
- `GET /health/details` — в dev: расширенные diagnostics (latency/errors/collections), в prod: только summary.
- Для production incident-response используйте `docs/sip-api-ops-runbook.md`.
- Для Cloud Run deploy/cutover используйте `docs/cloud-run-deploy.md`.

Проверки:
- Firebase Admin init;
- Firestore ping;
- доступность ожидаемых коллекций.

## Common failure modes

1. **404 HTML вместо JSON**
   - отсутствует redirect `/sip-editor-api/*`;
   - catch-all `/* /index.html 200` стоит выше.

2. **503/504**
   - upstream API недоступен/таймаутит;
   - UI должен показывать «backend/proxy unavailable», а не generic ошибку.

3. **Missing user context**
   - редактор открыт без `sipUserId` и без сохранённого session/local state.

## UI fail-safe

- Shell error boundary не роняет весь SPA.
- 3D error boundary локализует ошибки preview внутри панели.
- Загрузочные/ошибочные состояния разделены для:
  - project load;
  - current version load;
  - auth/context.

