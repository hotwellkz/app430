import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';

/** См. sip-editor-web: одна политика отбора кандидатов для internal bearing walls. */
export function getInternalWallCandidatesFromSnapshot(
  snapshot: ArchitecturalImportSnapshot
): ArchitecturalImportSnapshot['walls'] {
  const internal = snapshot.walls.filter((w) => w.typeHint === 'internal');
  if (internal.length > 0) return internal;
  const nonExternal = snapshot.walls.filter((w) => w.typeHint !== 'external');
  if (nonExternal.length > 0) return nonExternal;
  return [...snapshot.walls];
}
