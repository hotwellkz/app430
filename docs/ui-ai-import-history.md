# UI AI-import History (read-only slice)

## Scope

Первый frontend slice только для чтения истории `AI-import apply`.

- Источник: `GET /api/projects/:projectId/import-apply-history`.
- Без действий apply/retry-review/wizard.
- Без detail-screen по `versionId` (пока `isInspectable=false`).

## UI mini-contract

Backend item маппится в `ImportApplyHistoryViewItem`:

- `id`
- `appliedAt`
- `appliedBy`
- `importJobId` (компактный вид)
- `mapperVersion`
- `reviewedSnapshotVersion`
- `warningsCount`
- `traceCount`
- `isLegacy`
- `isIncomplete`
- `missingFields[]`
- `badgeKind`
- `badgeLabel`
- `subtitle`
- `isInspectable`

## Badge states

- `AI import` (`neutral`) — normal item.
- `Legacy` (`warning`) — legacy complete-ish item.
- `Incomplete legacy` (`danger`) — legacy item с неполными полями.

## Missing fields mapping

- `missingFields` из backend всегда проходят через UI mapping helper (`importHistoryMissingFields.ts`).
- Labels/hints берутся из централизованного dictionary registry (`importHistoryMissingFieldDictionary.ts`) — структура готова к будущим locale-веткам.
- Известные ключи показываются человеко-понятными labels (например: `appliedAt` -> `Время применения`).
- Неизвестный ключ не ломает UI: fallback `Неизвестное поле (<key>)`.
- В карточке incomplete item:
  - коротко показываются первые 1-2 labels;
  - если полей больше, добавляется `+N еще`;
  - полный список доступен через компактный expandable блок.

## Frontend filters

- `all` (по умолчанию)
- `normal`
- `legacy`
- `incomplete`

Фильтрация выполняется только на клиенте по уже загруженному списку.
Рядом с фильтрами показываются badge counters (`all/normal/legacy/incomplete`).

## Search and sort

- Search input: поиск по `importJobId` и `appliedBy` (case-insensitive).
- Sort modes (frontend-only):
  - `newest` (default)
  - `oldest`
- Поиск/сортировка работают поверх уже загруженного списка без backend параметров.

## Subtitle policy

- normal: `by <appliedBy> · mapper <mapperVersion> · warnings <count>`.
- incomplete legacy: `Неполная legacy запись: <missing fields>`.
- В UI не выводится raw JSON.

## Optional/legacy handling

- `missingFields` нормализуется и ограничивается компактным списком.
- Если в ответе mixed список normal + legacy, фронт просто рендерит все элементы в `newest-first` порядке backend.
- Если истории нет, показывается empty state.
- Если выбран фильтр и записей для него нет, показывается отдельный empty state для фильтра.
- Если search не находит совпадений, показывается отдельный search-empty state.
