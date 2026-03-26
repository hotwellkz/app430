# Export Workflow (Sprint 15)

## Scope

- Единый export-layer: `@2wix/export-engine` с режимами presentation.
- Поддерживаемые форматы:
  - PDF report
  - CSV
  - XLSX
- Поддерживаемые режимы:
  - `technical`
  - `commercial`

## Pipeline

- API берёт текущую сохраненную версию проекта (`current-version`).
- Строит:
  - panelization snapshot;
  - spec snapshot;
  - commercial snapshot (для `commercial` mode);
  - export package snapshot.
- Export metadata и snapshot сохраняются в Firestore (`sipEditor_projectExports`).
- Бинарный файл рендерится на backend и сохраняется в Firebase Storage.
- UI скачивает ready artifact повторно через download endpoint/signed URL.

## API endpoints

- `POST /api/projects/:projectId/exports`
- `GET /api/projects/:projectId/exports`
- `GET /api/projects/:projectId/exports/:exportId`
- `GET /api/projects/:projectId/exports/:exportId/download`

## Status lifecycle

- `pending` — экспорт создан, идёт генерация/upload.
- `ready` — файл успешно загружен в storage, доступен для повторного скачивания.
- `failed` — генерация или upload завершились ошибкой, доступен retry.

## PDF structure (MVP)

### Technical PDF

- project/version metadata
- expanded summary + totals by sourceType
- aggregated BOM
- object-level sections (walls/slabs/roof)
- warnings details

### Commercial PDF

- project/version metadata
- concise summary
- commercial sections (Walls/Slabs/Roof)
- grouped commercial items
- short warnings summary

## CSV/XLSX structure

- Technical CSV:
  - aggregated BOM table
- Commercial CSV:
  - commercial grouped items table
- Technical XLSX:
  - `Summary`
  - `BOM`
  - `Walls`
  - `Slabs`
  - `Roof`
  - `Warnings`
- Commercial XLSX:
  - `Summary`
  - `Commercial`
  - `Sections`
  - `Warnings`

## Version traceability

Каждый export artifact содержит:

- `projectId`
- `versionId`
- `format`
- `presentationMode`
- `createdAt`
- `createdBy`
- `status`
- `fileName`
- `storagePath`
- `fileUrl` (signed/temporary)
- `retryCount`
- `completedAt`

## Unsaved draft modes

Если есть несохранённые изменения:

- `Сохранить и экспортировать` — сначала save, потом export по обновлённой saved version.
- `Экспортировать текущую сохранённую версию` — экспорт без сохранения черновика.

UI явно показывает, из какой версии сделана выгрузка.

## Retry flow

- Для `failed` экспортов доступна кнопка `Retry`.
- Новый запуск учитывает `retryOfExportId`, инкрементирует `retryCount`.
- При повторной ошибке запись остаётся в `failed` с обновлённым `errorMessage`.

## Current limitations

- Нет real pricing/profit calculation (commercial mode cost-ready only).
- Нет ERP/warehouse/CNC integration.
- Нет async queue и heavy background workers.
- Нет ERP/CNC/advanced production exports.
