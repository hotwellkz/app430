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
  "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | FORBIDDEN | UNAUTHORIZED | INTERNAL_ERROR | IMPORT_CANDIDATE_NOT_READY | IMPORT_REVIEW_NOT_APPLIED | IMPORT_APPLY_CONCURRENCY_CONFLICT | IMPORT_CANDIDATE_MISSING | IMPORT_APPLY_FAILED",
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

### `POST /api/projects/:projectId/import-jobs`

Тело:

```json
{
  "sourceImages": [
    {
      "id": "img-1",
      "kind": "plan | facade | other",
      "fileName": "plan.png",
      "mimeType": "image/png",
      "widthPx": 1920,
      "heightPx": 1080,
      "storagePath": "optional/future",
      "fileUrl": "optional/future"
    }
  ],
  "projectName": "опционально"
}
```

Ответ `201`: `{ "job": ImportJob }`.

На текущем foundation-этапе используется **synchronous orchestration**:

1. создаётся `queued` job;
2. backend переводит её в `running`;
3. extractor adapter (сейчас `mock`) возвращает snapshot;
4. job получает `needs_review` + snapshot;
5. при ошибке — `failed` + `errorMessage`.

То есть `POST` возвращает итоговое состояние pipeline (`needs_review` или `failed`).

Режим выполнения управляется env `IMPORT_JOB_EXECUTION_MODE`:

- `sync` (default):
  - `POST` возвращает финальный `job` (`needs_review` или `failed`).
- `async-inline`:
  - `POST` возвращает ранний `job` (`queued` или `running`);
  - дальнейшее обновление статуса нужно читать через `GET /import-jobs` и `GET /import-jobs/:jobId`.

### `GET /api/projects/:projectId/import-jobs`

Ответ: `{ "items": ImportJob[] }` (новые сверху по `createdAt`).

### `GET /api/projects/:projectId/import-jobs/:jobId`

Ответ: `{ "job": ImportJob }`.

Если `jobId` не найден или не принадлежит проекту — `404 NOT_FOUND`.

### `POST /api/projects/:projectId/import-jobs/:jobId/review`

Тело (partial-save):

```json
{
  "updatedBy": "== x-sip-user-id",
  "decisions": {
    "floorHeightsMmByFloorId": { "floor-1": 2800 },
    "roofTypeConfirmed": "gabled",
    "internalBearingWalls": { "confirmed": true, "wallIds": ["w-1"] },
    "scale": { "mode": "override", "mmPerPixel": 2.5 },
    "issueResolutions": [{ "issueId": "issue-1", "action": "confirm" }]
  }
}
```

Ответ `200`: `{ "job": ImportJob }` с обновлённым `review` блоком.

### `POST /api/projects/:projectId/import-jobs/:jobId/apply-review`

Тело:

```json
{
  "appliedBy": "== x-sip-user-id"
}
```

Поведение:

- если review неполный -> `409 CONFLICT` с деталями missing decisions / blocking issues;
- если review complete -> сохраняется `review.reviewedSnapshot`.

Ответ `200`:

```json
{
  "job": { "...": "ImportJob" },
  "reviewedSnapshot": { "...": "ReviewedArchitecturalSnapshot" }
}
```

### `POST /api/projects/:projectId/import-jobs/:jobId/prepare-editor-apply`

Тело:

```json
{
  "generatedBy": "== x-sip-user-id"
}
```

Preconditions:

- `ImportJob.status = needs_review`
- `ImportJob.review.status = applied`
- `ImportJob.review.reviewedSnapshot` существует

Если preconditions не выполнены -> `409 CONFLICT`.

Успешный ответ `200`:

```json
{
  "job": { "...": "ImportJob with editorApply state" },
  "candidate": { "...": "BuildingModelCandidate" }
}
```

`BuildingModelCandidate` — отдельный backend result; он не применяет данные в текущую `ProjectVersion` автоматически.

### `POST /api/projects/:projectId/import-jobs/:jobId/apply-candidate`

Тело:

```json
{
  "appliedBy": "== x-sip-user-id",
  "expectedCurrentVersionId": "current version id",
  "expectedVersionNumber": 1,
  "expectedSchemaVersion": 2,
  "note": "optional audit note"
}
```

Preconditions:

- `ImportJob.status = needs_review`
- `ImportJob.review.status = applied`
- `ImportJob.editorApply.status = candidate_ready`
- `ImportJob.editorApply.candidate` существует

Поведение:

- делает optimistic concurrency check по `expected*`;
- применяет `editorApply.candidate.model` в `PATCH current-version` flow;
- сохраняет audit/result в `ImportJob.projectApply`;
- пишет lightweight provenance в metadata примененной `ProjectVersion` (`importProvenance`).

Ошибки:

- `404 NOT_FOUND` — job не найдена или foreign project/job.
- `409 IMPORT_CANDIDATE_NOT_READY` — candidate stage не готов.
- `409 IMPORT_REVIEW_NOT_APPLIED` — review не в applied.
- `409 IMPORT_CANDIDATE_MISSING` — candidate отсутствует.
- `409 IMPORT_APPLY_CONCURRENCY_CONFLICT` — mismatch optimistic marker.
- `500 IMPORT_APPLY_FAILED` — неожиданный persistence/runtime failure.

### `GET /api/projects/:projectId/import-apply-history`

Read-only history AI-import apply событий для проекта.

Поведение:

- проверяет доступ к проекту;
- читает provenance из metadata `ProjectVersion.importProvenance`;
- возвращает newest-first;
- если истории нет, возвращает пустой `items: []`.
- soft legacy policy:
  - версия без `importProvenance` не попадает в историю;
  - неполный legacy provenance возвращается безопасно с `isLegacy=true`, `isIncomplete=true`, `missingFields`.
  - mixed набор (normal + legacy) сохраняет `newest-first` сортировку по `appliedAt`.

Observability markers (backend logs, без внешних SDK):

- `import_apply_candidate_success` — успешный `apply-candidate` (project/job/version).
- `import_apply_candidate_conflict` — conflict при `apply-candidate` (code + version context).
- `import_history_legacy_item_detected` — обнаружен legacy/incomplete item в history mapping.

Успешный ответ `200`:

```json
{
  "items": [
    {
      "versionId": "v2",
      "versionNumber": 2,
      "sourceKind": "ai_import",
      "importJobId": "ij-2",
      "mapperVersion": "import-candidate-v1",
      "reviewedSnapshotVersion": "rev-2",
      "appliedBy": "uid",
      "appliedAt": "ISO",
      "warningsCount": 1,
      "traceCount": 17,
      "note": "optional",
      "isLegacy": true,
      "isIncomplete": true,
      "missingFields": ["reviewedSnapshotVersion"]
    }
  ]
}
```

Успешный ответ `200`:

```json
{
  "job": { "...": "ImportJob with projectApply state" },
  "appliedVersionMeta": {
    "id": "v1",
    "projectId": "p1",
    "versionNumber": 1,
    "schemaVersion": 2,
    "createdAt": "ISO"
  },
  "applySummary": {
    "createdOrUpdatedVersionId": "v1",
    "appliedObjectCounts": { "floors": 1, "walls": 4, "openings": 2, "slabs": 1, "roofs": 1 },
    "warningsCount": 0,
    "traceCount": 7,
    "basedOnImportJobId": "ij-1",
    "basedOnMapperVersion": "import-candidate-v1",
    "basedOnReviewedSnapshotVersion": "..."
  }
}
```

## Доступ

- Пустой `allowedEditorIds` в проекте: редактировать может только `createdBy`.
- Непустой `allowedEditorIds`: только перечисленные UID (создатель не добавляется автоматически, кроме случая `POST /projects`, где `createdBy` мёржится в список при передаче массива).
- Нет `createdBy` и нет списка (legacy): доступ разрешён любому пользователю с заголовком (только для миграции; см. `technical-decisions.md`).
