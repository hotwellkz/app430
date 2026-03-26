# Export Storage Contract (Sprint 12)

## Object storage contract

- Provider: Firebase Storage.
- Path template:
  - `sip-exports/{projectId}/{versionId}/{exportId}/{fileName}`

## Export artifact metadata

Persisted in Firestore export record:

- `status`: pending | ready | failed
- `storagePath`
- `fileUrl` (optional, signed temporary URL)
- `sizeBytes`
- `mimeType`
- `retryCount`
- `completedAt`
- `errorMessage`

## Download behavior

- Primary: `GET /api/projects/:projectId/exports/:exportId/download`
  - returns temporary signed URL + fileName.
- list/get endpoints may also include temporary `fileUrl` for convenience.
- Ready exports can be re-downloaded later (cross-session).

## Legacy compatibility

- Старые exports без `storagePath/fileUrl` отображаются как legacy.
- UI не падает на missing fields и явно показывает, что запись legacy.

## Limitations

- Generation + upload выполняется в текущем request lifecycle (pseudo-async UX).
- Нет отдельной queue/worker orchestration.
