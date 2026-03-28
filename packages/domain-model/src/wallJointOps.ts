import type { BuildingModel, Point2D, Wall, WallJoint } from '@2wix/shared-types';
import { findWallById, getFloorById } from './modelUtils.js';
import { newDomainId } from './ids.js';

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ensureWallJointsArray(model: BuildingModel): BuildingModel {
  if (model.wallJoints && model.wallJoints.length >= 0) return model;
  return { ...model, wallJoints: [] };
}

export function getWallJointById(model: BuildingModel, jointId: string): WallJoint | undefined {
  return model.wallJoints?.find((j) => j.id === jointId);
}

/** Число стен, ссылающихся на узел (start или end). */
export function countWallsReferencingJoint(model: BuildingModel, jointId: string): number {
  let n = 0;
  for (const w of model.walls) {
    if (w.startJointId === jointId) n += 1;
    if (w.endJointId === jointId) n += 1;
  }
  return n;
}

/** Превью: стены этажа после переноса узла (без валидации). */
export function wallsOnFloorAfterJointMove(
  model: BuildingModel,
  floorId: string,
  jointId: string,
  pos: Point2D
): Wall[] {
  return model.walls.filter((w) => w.floorId === floorId).map((w) => {
    let nw = w;
    if (w.startJointId === jointId) nw = { ...nw, start: { ...pos } };
    if (w.endJointId === jointId) nw = { ...nw, end: { ...pos } };
    return nw;
  });
}

export function pruneUnusedWallJoints(model: BuildingModel): BuildingModel {
  const joints = model.wallJoints ?? [];
  if (joints.length === 0) return model;
  const used = new Set<string>();
  for (const w of model.walls) {
    if (w.startJointId) used.add(w.startJointId);
    if (w.endJointId) used.add(w.endJointId);
  }
  const next = joints.filter((j) => used.has(j.id));
  if (next.length === joints.length) return model;
  return { ...model, wallJoints: next };
}

export function moveWallJointInModel(
  model: BuildingModel,
  jointId: string,
  pos: Point2D
): BuildingModel | { ok: false; reason: string } {
  const joints = [...(model.wallJoints ?? [])];
  const idx = joints.findIndex((j) => j.id === jointId);
  if (idx < 0) return { ok: false, reason: 'Узел не найден' };
  joints[idx] = { ...joints[idx]!, x: pos.x, y: pos.y };

  const walls = model.walls.map((w) => {
    let nw = w;
    if (w.startJointId === jointId) {
      nw = { ...nw, start: { x: pos.x, y: pos.y } };
    }
    if (w.endJointId === jointId) {
      nw = { ...nw, end: { x: pos.x, y: pos.y } };
    }
    return nw;
  });

  return { ...model, wallJoints: joints, walls };
}

function replaceWallAt(model: BuildingModel, wallId: string, wall: Wall): BuildingModel {
  const walls = model.walls.map((w) => (w.id === wallId ? wall : w));
  return { ...model, walls };
}

/** Обновление только координат конца без учёта узлов (внутренний шаг). */
const LENGTH_EPS_MM = 1e-3;

function setWallEndpointCoords(
  model: BuildingModel,
  wallId: string,
  endpoint: 'start' | 'end',
  pos: Point2D
): BuildingModel | { ok: false; reason: string } {
  const prev = findWallById(model, wallId);
  if (!prev) return { ok: false, reason: 'Стена не найдена' };
  const next: Wall =
    endpoint === 'start'
      ? { ...prev, start: { ...pos } }
      : { ...prev, end: { ...pos } };
  if (!getFloorById(model, next.floorId)) {
    return { ok: false, reason: 'Указанный этаж не существует' };
  }
  const len = Math.hypot(next.end.x - next.start.x, next.end.y - next.start.y);
  if (len <= LENGTH_EPS_MM) {
    return { ok: false, reason: 'Начало и конец стены совпадают или длина равна нулю' };
  }
  if (next.thicknessMm <= 0 || !Number.isFinite(next.thicknessMm)) {
    return { ok: false, reason: 'Толщина стены должна быть положительным числом' };
  }
  return replaceWallAt(model, wallId, next);
}

/**
 * Применяет patch start/end с учётом узлов: если у конца есть jointId — двигается весь узел.
 */
export function applyWallGeometryPatch(
  model: BuildingModel,
  wallId: string,
  patch: Partial<Pick<Wall, 'start' | 'end'>>
): BuildingModel | { ok: false; reason: string } {
  const prev = findWallById(model, wallId);
  if (!prev) return { ok: false, reason: 'Стена не найдена' };

  const hasStart = patch.start !== undefined;
  const hasEnd = patch.end !== undefined;
  if (!hasStart && !hasEnd) {
    return model;
  }

  if (hasStart && hasEnd && patch.start && patch.end) {
    const s = patch.start;
    const e = patch.end;
    if (prev.startJointId && prev.endJointId && prev.startJointId === prev.endJointId) {
      return { ok: false, reason: 'Вырожденная стена: один узел на оба конца' };
    }
    let m: BuildingModel = model;
    if (prev.startJointId) {
      const r = moveWallJointInModel(m, prev.startJointId, s);
      if ('ok' in r && (r as { ok: false }).ok === false) return r as { ok: false; reason: string };
      m = r as BuildingModel;
    } else {
      const r = setWallEndpointCoords(m, wallId, 'start', s);
      if ('ok' in r && (r as { ok: false }).ok === false) return r as { ok: false; reason: string };
      m = r as BuildingModel;
    }
    if (prev.endJointId) {
      const r = moveWallJointInModel(m, prev.endJointId, e);
      if ('ok' in r && (r as { ok: false }).ok === false) return r as { ok: false; reason: string };
      m = r as BuildingModel;
    } else {
      const r = setWallEndpointCoords(m, wallId, 'end', e);
      if ('ok' in r && (r as { ok: false }).ok === false) return r as { ok: false; reason: string };
      m = r as BuildingModel;
    }
    return pruneUnusedWallJoints(m);
  }

  if (hasStart && patch.start) {
    if (prev.startJointId) {
      const m = moveWallJointInModel(model, prev.startJointId, patch.start);
      if ('ok' in m && (m as { ok: false }).ok === false) return m as { ok: false; reason: string };
      return pruneUnusedWallJoints(m as BuildingModel);
    }
    const m = setWallEndpointCoords(model, wallId, 'start', patch.start);
    if ('ok' in m && (m as { ok: false }).ok === false) return m as { ok: false; reason: string };
    return m as BuildingModel;
  }

  if (hasEnd && patch.end) {
    if (prev.endJointId) {
      const m = moveWallJointInModel(model, prev.endJointId, patch.end);
      if ('ok' in m && (m as { ok: false }).ok === false) return m as { ok: false; reason: string };
      return pruneUnusedWallJoints(m as BuildingModel);
    }
    const m = setWallEndpointCoords(model, wallId, 'end', patch.end);
    if ('ok' in m && (m as { ok: false }).ok === false) return m as { ok: false; reason: string };
    return m as BuildingModel;
  }

  return model;
}

function findNearestJoint(
  model: BuildingModel,
  floorId: string,
  pt: Point2D,
  toleranceMm: number
): WallJoint | undefined {
  let best: WallJoint | undefined;
  let bestD = toleranceMm;
  for (const j of model.wallJoints ?? []) {
    if (j.floorId !== floorId) continue;
    const d = dist(pt, j);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/**
 * Находит или создаёт узел рядом с точкой; при совпадении с существующим — возвращает его id.
 */
export function findOrCreateJointNear(
  model: BuildingModel,
  floorId: string,
  pt: Point2D,
  toleranceMm: number
): { model: BuildingModel; jointId: string } {
  let m = ensureWallJointsArray(model);
  const existing = findNearestJoint(m, floorId, pt, toleranceMm);
  if (existing) {
    return { model: m, jointId: existing.id };
  }
  const id = newDomainId();
  const nj: WallJoint = { id, floorId, x: pt.x, y: pt.y };
  return { model: { ...m, wallJoints: [...(m.wallJoints ?? []), nj] }, jointId: id };
}

/**
 * После добавления стены: привязать концы к узлам в радиусе tolerance, подставить координаты узла.
 */
export function attachWallEndpointsToJoints(
  model: BuildingModel,
  wallId: string,
  toleranceMm: number = 160
): BuildingModel {
  const w0 = findWallById(model, wallId);
  if (!w0) return model;
  let m = ensureWallJointsArray(model);
  let w = w0;

  for (const ep of ['start', 'end'] as const) {
    const pt = ep === 'start' ? w.start : w.end;
    const { model: m1, jointId } = findOrCreateJointNear(m, w.floorId, pt, toleranceMm);
    m = m1;
    const j = getWallJointById(m, jointId)!;
    const snapped = { x: j.x, y: j.y };
    if (ep === 'start') {
      w = { ...w, start: snapped, startJointId: jointId };
    } else {
      w = { ...w, end: snapped, endJointId: jointId };
    }
    m = replaceWallAt(m, wallId, w);
  }

  return pruneUnusedWallJoints(m);
}

export function detachWallEndpointInModel(
  model: BuildingModel,
  wallId: string,
  endpoint: 'start' | 'end'
): BuildingModel | { ok: false; reason: string } {
  const w = findWallById(model, wallId);
  if (!w) return { ok: false, reason: 'Стена не найдена' };
  const jointId = endpoint === 'start' ? w.startJointId : w.endJointId;
  if (!jointId) return model;

  const next: Wall = { ...w };
  if (endpoint === 'start') {
    next.start = { ...w.start };
    delete next.startJointId;
  } else {
    next.end = { ...w.end };
    delete next.endJointId;
  }
  let m = replaceWallAt(model, wallId, next);
  m = pruneUnusedWallJoints(m);
  return m;
}

/**
 * После mergeNearbyWallEndpoints: пересобрать узлы из кластеров концов (один joint на кластер).
 */
export function rebuildWallJointsFromWallEndpoints(
  model: BuildingModel,
  toleranceMm: number = 160
): BuildingModel {
  const walls = model.walls.map((w) => ({
    ...w,
    start: { ...w.start },
    end: { ...w.end },
  }));
  if (walls.length === 0) {
    return { ...model, walls, wallJoints: [] };
  }

  type Ep = { wallIndex: number; end: 'start' | 'end' };
  const pts: Point2D[] = [];
  const meta: Ep[] = [];
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i]!;
    pts.push(w.start, w.end);
    meta.push({ wallIndex: i, end: 'start' }, { wallIndex: i, end: 'end' });
  }

  const n = pts.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = Array.from({ length: n }, () => 0);
  function ufFind(i: number): number {
    if (parent[i] !== i) parent[i] = ufFind(parent[i]!);
    return parent[i]!;
  }
  function ufUnion(a: number, b: number): void {
    let ra = ufFind(a);
    let rb = ufFind(b);
    if (ra === rb) return;
    if (rank[ra]! < rank[rb]!) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra]! += 1;
  }

  const tol = Math.max(20, toleranceMm);
  for (let i = 0; i < n; i += 1) {
    const fi = walls[meta[i]!.wallIndex]!.floorId;
    for (let j = i + 1; j < n; j += 1) {
      const fj = walls[meta[j]!.wallIndex]!.floorId;
      if (fi !== fj) continue;
      if (dist(pts[i]!, pts[j]!) <= tol) ufUnion(i, j);
    }
  }

  const sumX = new Map<number, number>();
  const sumY = new Map<number, number>();
  const cnt = new Map<number, number>();
  const floorByRoot = new Map<number, string>();
  for (let i = 0; i < n; i += 1) {
    const r = ufFind(i);
    const p = pts[i]!;
    sumX.set(r, (sumX.get(r) ?? 0) + p.x);
    sumY.set(r, (sumY.get(r) ?? 0) + p.y);
    cnt.set(r, (cnt.get(r) ?? 0) + 1);
    const ep = meta[i]!;
    const f = walls[ep.wallIndex]!.floorId;
    if (!floorByRoot.has(r)) floorByRoot.set(r, f);
  }

  const jointIdByRoot = new Map<number, string>();
  const newJoints: WallJoint[] = [];
  for (const [r, c] of cnt) {
    const x = sumX.get(r)! / c;
    const y = sumY.get(r)! / c;
    const id = newDomainId();
    jointIdByRoot.set(r, id);
    newJoints.push({
      id,
      floorId: floorByRoot.get(r) ?? '',
      x,
      y,
    });
  }

  for (let i = 0; i < n; i += 1) {
    const r = ufFind(i);
    const jid = jointIdByRoot.get(r)!;
    const cx = sumX.get(r)! / cnt.get(r)!;
    const cy = sumY.get(r)! / cnt.get(r)!;
    const ep = meta[i]!;
    const wi = ep.wallIndex;
    const w = walls[wi]!;
    if (ep.end === 'start') {
      walls[wi] = { ...w, start: { x: cx, y: cy }, startJointId: jid };
    } else {
      walls[wi] = { ...w, end: { x: cx, y: cy }, endJointId: jid };
    }
  }

  return { ...model, walls, wallJoints: newJoints };
}
