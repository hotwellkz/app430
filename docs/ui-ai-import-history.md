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

## Subtitle policy

- normal: `by <appliedBy> · mapper <mapperVersion> · warnings <count>`.
- incomplete legacy: `Неполная legacy запись: <missing fields>`.
- В UI не выводится raw JSON.

## Optional/legacy handling

- `missingFields` нормализуется и ограничивается компактным списком.
- Если в ответе mixed список normal + legacy, фронт просто рендерит все элементы в `newest-first` порядке backend.
- Если истории нет, показывается явный empty state.
