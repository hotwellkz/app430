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

## Что пока не сделано

- Реальный extractor (OCR/vision/LLM).
- Wizard/review/apply flow.
- Преобразование snapshot в `BuildingModel`.
- Construction profile engine.
- Upload pipeline бинарников изображений (храним только refs/metadata).

## Следующий шаг

1. Review/apply backend contracts и wizard skeleton.
2. Интеграция реального extractor adapter вместо mock (через mode/feature flag).
3. Подключение construction profile и валидаций перед apply.
