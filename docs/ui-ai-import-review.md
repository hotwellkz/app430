# UI: AI Import Review (MVP wizard)

Клиентский поток review / apply поверх существующих SIP API endpoints import-job. Реализовано в `apps/sip-editor-web` как панель в правой колонке редактора (`EditorShellPage`).

## Модули

| Зона | Путь |
|------|------|
| API | `src/api/projectsApi.ts` — `listImportJobs`, `getImportJob`, `saveImportJobReview`, `applyImportJobReview`, `prepareImportJobEditorApply`, `applyImportJobCandidateToProject` |
| Хук | `src/hooks/useImportReviewPanel.ts` |
| Константы / подписи | `src/import-review/constants/labels.ts` |
| View-model | `src/import-review/viewModel/` — `reviewReadiness.ts`, `importReviewMappers.ts`, `decisionsDraft.ts`, типы в `importReviewViewModel.types.ts` |
| UI | `src/import-review/components/ImportReviewPanelView.tsx` |
| Контейнер | `src/components/ImportReviewPanel.tsx` |

## Пользовательский сценарий

1. Открыть проект в SIP Editor (с `x-sip-user-id` / `sipUserId`).
2. В правой панели блок **AI Import Review** — обновить список при необходимости.
3. Выбрать job в списке (новые сверху).
4. Просмотреть статусы (экстракция, review, candidate, применение в проект), сводку и issues.
5. Заполнить обязательные решения (высоты этажей, крыша при наличии hints, несущие, масштаб, разрешения blocking issues).
6. **Сохранить черновик** → `POST .../review`.
7. **Применить review** → при несохранённых правках сначала сохранение, затем `POST .../apply-review`.
8. **Подготовить candidate** → `POST .../prepare-editor-apply` (только при `review.status === applied`).
9. **Применить candidate к проекту** → `POST .../apply-candidate` с маркерами optimistic concurrency из текущего состояния редактора (`expectedCurrentVersionId`, `expectedVersionNumber`, `expectedSchemaVersion`).

## Ограничения MVP

- Нет canvas, overlay, diff, загрузки изображений, OCR.
- История применений (`ImportApplyHistoryPanel`) не изменялась, только соседство в layout.
- Ошибки API показываются через `SipApiError` / код / `requestId` без «сырого» dump.

## Тесты

- `import-review/viewModel/reviewReadiness.test.ts` — логика готовности review.
- `import-review/viewModel/importReviewMappers.test.ts` — флаги кнопок и маппинг.
- `import-review/components/ImportReviewPanelView.test.tsx` — состояния панели.
- `components/ImportReviewPanel.integration.test.tsx` — сценарии с моком `projectsApi`.

## Конфигурация тестов

В `vitest.config.ts` добавлен alias `@` → `src`, чтобы интеграционные тесты резолвили те же импорты, что и приложение.
