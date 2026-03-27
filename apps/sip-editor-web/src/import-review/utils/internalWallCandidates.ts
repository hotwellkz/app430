import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';

/** Длина полилинии в условных единицах плана (px). */
export function polylineLengthPx(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    s += Math.hypot(dx, dy);
  }
  return s;
}

/**
 * Список стен для выбора «внутренние несущие».
 * Политика: 1) только typeHint === internal; 2) если пусто — не external;
 * 3) если всё ещё пусто — все стены snapshot (тип неясен).
 */
export function getInternalWallCandidatesFromSnapshot(
  snap: ArchitecturalImportSnapshot
): ArchitecturalImportSnapshot['walls'] {
  const internal = snap.walls.filter((w) => w.typeHint === 'internal');
  if (internal.length > 0) return internal;
  const nonExternal = snap.walls.filter((w) => w.typeHint !== 'external');
  if (nonExternal.length > 0) return nonExternal;
  return [...snap.walls];
}

export function floorLabelForSnapshot(
  snap: ArchitecturalImportSnapshot,
  floorId: string
): string {
  const f = snap.floors.find((fl) => fl.id === floorId);
  return f?.label?.trim() ? String(f.label) : floorId;
}

export function wallTypeLabel(
  w: ArchitecturalImportSnapshot['walls'][number]
): string {
  if (w.typeHint === 'internal') return 'Внутренняя';
  if (w.typeHint === 'external') return 'Внешняя';
  return 'Тип не указан';
}

export function wallSubtitleCompact(
  w: ArchitecturalImportSnapshot['walls'][number]
): string {
  const n = w.points?.length ?? 0;
  const len = polylineLengthPx(w.points ?? []);
  const th = w.thicknessHintMm;
  const parts = [
    `${n} точ.`,
    len > 0 ? `~${len.toFixed(0)} px` : null,
    typeof th === 'number' && th > 0 ? `t≈${th} мм` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
