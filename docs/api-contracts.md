# SIP Editor API — контракты (Fastify)

Базовый URL в dev: `http://localhost:3001` (CRM прокси: `/sip-editor-api`).

## Заголовки

| Заголовок | Обязательность | Описание |
|-----------|----------------|----------|
| `Content-Type: application/json` | для POST/PATCH | |
| `x-sip-user-id` | **обязателен** для всех `/api/projects/*` | Firebase UID пользователя CRM (временный bridge). |
| `x-request-id` | опционально | Прокидывается в ответ как `requestId`. |

## Формат ошибки

```json
{
  "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | FORBIDDEN | UNAUTHORIZED | INTERNAL_ERROR",
  "message": "Человекочитаемое описание",
  "status": 400,
  "details": {},
  "requestId": "uuid"
}
```

### 409 CONFLICT (PATCH current-version)

`details` содержит:

```json
{
  "currentVersionId": "string",
  "currentVersionNumber": 0,
  "serverUpdatedAt": "ISO-8601"
}
```

## Endpoints

### `GET /health`

Без заголовков. Ответ:

```json
{
  "ok": true,
  "service": "sip-editor-api",
  "timestamp": "ISO",
  "requestId": "uuid",
  "checks": {
    "firebaseAdmin": "ok",
    "firestorePing": "ok",
    "collections": "ok"
  }
}
```

### `GET /health/details`

- `development`: расширенные diagnostics (latency/errors/environment без секретов).
- `production`: summary в формате `/health`.

### `POST /api/projects`

Тело:

```json
{
  "title": "опционально",
  "dealId": "string | null",
  "createdBy": "обязателен, должен совпадать с x-sip-user-id",
  "allowedEditorIds": ["uid1", "uid2"]
}
```

`allowedEditorIds` опционально; если передан массив, в него автоматически добавляется `createdBy`, если его там не было.

Ответ `201`: `{ "project": {...}, "currentVersion": {...} }`.

### `GET /api/projects/:projectId`

Ответ: `{ "project": Project }`.

### `GET /api/projects/:projectId/current-version`

Ответ: `{ "version": ProjectVersion }` или `404`, если нет текущей версии.

### `GET /api/projects/:projectId/versions`

Ответ: `{ "versions": ProjectVersion[] }` (по убыванию `versionNumber`).

### `POST /api/projects/:projectId/versions`

Тело:

```json
{
  "createdBy": "обязателен, == x-sip-user-id",
  "basedOnVersionId": "опционально для mode=from-version",
  "mode": "clone-current | from-version"
}
```

По умолчанию `clone-current`: копия **текущей** рабочей версии, новый `versionNumber = versionCounter + 1`, проект переключается на новую версию.

Ответ `201`: `{ "version": ProjectVersion }`.

### `PATCH /api/projects/:projectId/current-version`

Optimistic concurrency. Тело:

```json
{
  "buildingModel": { "...": "BuildingModel" },
  "updatedBy": "== x-sip-user-id",
  "expectedCurrentVersionId": "id документа текущей версии",
  "expectedVersionNumber": 1,
  "expectedSchemaVersion": 1
}
```

Если ожидания не совпали с Firestore → **409** с `details` как выше.

Ответ `200`: `{ "version": ProjectVersion }`.

## Доступ

- Пустой `allowedEditorIds` в проекте: редактировать может только `createdBy`.
- Непустой `allowedEditorIds`: только перечисленные UID (создатель не добавляется автоматически, кроме случая `POST /projects`, где `createdBy` мёржится в список при передаче массива).
- Нет `createdBy` и нет списка (legacy): доступ разрешён любому пользователю с заголовком (только для миграции; см. `technical-decisions.md`).
