# AI Import Foundation (Sprint 16, Phase 1)

## Что сделано

- Добавлен backend/domain foundation для `import-job` без OCR/vision/LLM extraction.
- Введена canonical intermediate schema: `ArchitecturalImportSnapshot`.
- Реализованы API endpoints создания и чтения import-job.
- Добавлен честный mock snapshot factory без фальшивой геометрии.
- Добавлена персистенция import jobs в отдельную Firestore коллекцию.

## Endpoints

- `POST /api/projects/:projectId/import-jobs`
  - Создаёт import-job.
  - Сохраняет refs исходных изображений.
  - Генерирует mock snapshot.
  - Ставит статус `needs_review`.
- `GET /api/projects/:projectId/import-jobs`
  - Возвращает jobs проекта (новые сверху).
- `GET /api/projects/:projectId/import-jobs/:jobId`
  - Возвращает одну job.
  - Возвращает 404, если job не найдена или не принадлежит проекту.

## Mock import snapshot

На foundation этапе snapshot валиден структурно, но не делает вид, что extractor уже умеет распознавание:

- `floors`: один минимальный floor (`floor-1`);
- `outerContour`: `null`;
- `walls/openings/stairs`: пустые;
- `unresolved`: blocking issue `EXTRACTOR_NOT_CONNECTED`;
- `notes`: явная пометка про mock без AI extractor.

## Что пока не сделано

- Реальный extractor (OCR/vision/LLM).
- Wizard/review/apply flow.
- Преобразование snapshot в `BuildingModel`.
- Construction profile engine.
- Upload pipeline бинарников изображений (храним только refs/metadata).

## Следующий шаг

1. Wizard/review/apply поверх import-job lifecycle.
2. Интеграция реального extractor в pipeline `queued/running/needs_review/failed`.
3. Подключение construction profile и правил валидации перед apply.
