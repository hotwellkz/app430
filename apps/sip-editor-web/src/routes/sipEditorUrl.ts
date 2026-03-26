/** Собрать URL редактора с обязательным sipUserId (для CRM и dev). */
export function buildSipEditorProjectUrl(
  projectId: string,
  sipUserId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const base = origin.replace(/\/$/, '');
  const q = new URLSearchParams({ sipUserId: sipUserId.trim() });
  return `${base}/sip-editor/${encodeURIComponent(projectId.trim())}?${q.toString()}`;
}
