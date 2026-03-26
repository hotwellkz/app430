# AI Import Foundation (Sprint 16, Phase 2)

## Что сделано

- Добавлен lifecycle pipeline для `import-job`: `queued -> running -> needs_review | failed`.
- Добавлен orchestration service с централизованными status transitions.
- Введена extractor adapter abstraction (`mock` implementation + resolver).
- Добавлены execution modes для запуска pipeline:
  - `sync`
  - `async-inline`
- Сохранена canonical intermediate schema `ArchitecturalImportSnapshot`.
- Персистенция import jobs остаётся в отдельной Firestore коллекции.
- Добавлен review/apply backend слой:
  - decisions сохраняются отдельно от extractor snapshot;
  - apply-review создаёт отдельный `ReviewedArchitecturalSnapshot` (без BuildingModel mapping).
- Добавлен explicit editor-apply backend stage:
  - из `review.reviewedSnapshot` строится `BuildingModelCandidate`;
  - candidate сохраняется в `importJob.editorApply`;
  - реальный apply в editor/version выполняется отдельным explicit контрактом `apply-candidate`.
- Добавлен explicit project-apply backend stage:
  - `POST /api/projects/:projectId/import-jobs/:jobId/apply-candidate`;
  - apply использует `editorApply.candidate.model` как source-of-write;
  - apply требует optimistic concurrency (`expectedCurrentVersionId/expectedVersionNumber/expectedSchemaVersion`);
  - результат пишется в отдельный блок `importJob.projectApply` с audit/provenance.
- Добавлен provenance metadata в `ProjectVersion`:
  - сохраняется только после успешного apply-candidate;
  - не меняет source-of-truth `BuildingModel`;
  - используется read-only endpoint историй apply операций.

## Endpoints

- `POST /api/projects/:projectId/import-jobs`
  - Создаёт import-job.
  - Сохраняет refs исходных изображений.
  - Запускает backend pipeline через runner abstraction.
- `GET /api/projects/:projectId/import-jobs`
  - Возвращает jobs проекта (новые сверху).
- `GET /api/projects/:projectId/import-jobs/:jobId`
  - Возвращает одну job.
  - Возвращает 404, если job не найдена или не принадлежит проекту.
- `POST /api/projects/:projectId/import-jobs/:jobId/review`
  - Сохраняет partial decisions.
  - Пересчитывает readiness и remaining blocking issues.
- `POST /api/projects/:projectId/import-jobs/:jobId/apply-review`
  - Проверяет completeness review.
  - Создаёт и сохраняет `ReviewedArchitecturalSnapshot`.
- `POST /api/projects/:projectId/import-jobs/:jobId/prepare-editor-apply`
  - Проверяет preconditions (`review.status=applied`, есть `reviewedSnapshot`).
  - Строит `BuildingModelCandidate` через deterministic mapper.
  - Сохраняет candidate в `editorApply`.
- `POST /api/projects/:projectId/import-jobs/:jobId/apply-candidate`
  - Отдельный explicit шаг применения candidate в текущую project version.
  - Preconditions: `job.status=needs_review`, `review.status=applied`, `editorApply.status=candidate_ready`, есть `editorApply.candidate`.
  - При mismatch optimistic marker -> `409 IMPORT_APPLY_CONCURRENCY_CONFLICT`.
  - На успехе сохраняет `projectApply` audit (`appliedBy`, `appliedAt`, `appliedVersionId`, summary).
- `GET /api/projects/:projectId/import-apply-history`
  - Возвращает историю AI-import apply по проекту (newest first) из `ProjectVersion.importProvenance`.
  - Если истории нет, возвращает пустой список.
  - Legacy/incomplete provenance обрабатывается мягко (`isLegacy`, `isIncomplete`, `missingFields`).
  - Legacy classification выполняется pure helper-слоем (deterministic mapping, unit-testable).

## Mock import snapshot

На текущем этапе используется mock extractor adapter. Snapshot валиден структурно, но не делает вид, что extractor уже умеет распознавание:

- `floors`: один минимальный floor (`floor-1`);
- `outerContour`: `null`;
- `walls/openings/stairs`: пустые;
- `unresolved`: blocking issue `EXTRACTOR_NOT_CONNECTED`;
- `notes`: явная пометка про mock без AI extractor.

## Lifecycle статусов

- `queued` — job создана и ожидает обработки.
- `running` — backend pipeline выполняет extraction.
- `needs_review` — extraction завершён, snapshot сохранён, требуется human review.
- `failed` — pipeline завершился ошибкой, сохранён `errorMessage`.

## Execution modes

- `sync` (по умолчанию):
  - `POST` ждёт завершения pipeline и возвращает финальный статус (`needs_review` или `failed`).
- `async-inline`:
  - `POST` создаёт job и инициирует pipeline отдельно от request-response пути;
  - ответ возвращается ранним (`queued`), а финальный статус читается через `GET` endpoints;
  - это переходный режим перед будущим worker/queue execution.

## Review/apply model

- `snapshot` — исходный extraction result (source-of-truth для extraction).
- `review.decisions` — явные пользовательские решения (partial-save поддерживается).
- `review.isReadyToApply` + `review.missingRequiredDecisions` + `review.remainingBlockingIssueIds` — централизованная оценка готовности.
- `review.reviewedSnapshot` — отдельный результат apply-review; исходный `snapshot` при этом не мутируется.
- `editorApply.candidate` — отдельный editor-compatible кандидат, не равный `BuildingModel` проекта.
- `projectApply` — отдельный результат применения candidate в project/version (не смешан с candidate generation).
- Observability markers:
  - `import_apply_candidate_success`,
  - `import_apply_candidate_conflict`,
  - `import_history_legacy_item_detected`.

## Что пока не сделано

- Реальный extractor (OCR/vision/LLM).
- Wizard/review/apply flow.
- UI diff и merge candidate с ручными правками.
- Worker/queue infrastructure.
- Construction profile engine.
- Upload pipeline бинарников изображений (храним только refs/metadata).

## Следующий шаг

1. Review/apply backend contracts и wizard skeleton.
2. Интеграция реального extractor adapter вместо mock (через mode/feature flag).
3. Подключение construction profile и валидаций перед apply.
