import type { BuildingModel, Point2D, Wall } from '@2wix/shared-types';
import { cloneBuildingModel } from './modelUtils.js';

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ufFind(parent: number[], i: number): number {
  if (parent[i] !== i) parent[i] = ufFind(parent, parent[i]!);
  return parent[i]!;
}

function ufUnion(parent: number[], rank: number[], a: number, b: number): void {
  let ra = ufFind(parent, a);
  let rb = ufFind(parent, b);
  if (ra === rb) return;
  if (rank[ra]! < rank[rb]!) [ra, rb] = [rb, ra];
  parent[rb] = ra;
  if (rank[ra] === rank[rb]) rank[ra]! += 1;
}

/**
 * Стыкует концы стен в кластеры по расстоянию и переносит все к центроиду кластера.
 * Один шаг «пересчёта» геометрии для ручного чертежа.
 */
export function mergeNearbyWallEndpoints(model: BuildingModel, toleranceMm: number = 150): BuildingModel {
  const walls: Wall[] = model.walls.map((w) => ({
    ...w,
    start: { ...w.start },
    end: { ...w.end },
  }));
  if (walls.length === 0) return cloneBuildingModel(model);

  const pts: Point2D[] = [];
  for (const w of walls) {
    pts.push(w.start, w.end);
  }
  const n = pts.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = Array.from({ length: n }, () => 0);
  const tol = Math.max(20, toleranceMm);

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (dist(pts[i]!, pts[j]!) <= tol) {
        ufUnion(parent, rank, i, j);
      }
    }
  }

  const sumX = new Map<number, number>();
  const sumY = new Map<number, number>();
  const cnt = new Map<number, number>();
  for (let i = 0; i < n; i += 1) {
    const r = ufFind(parent, i);
    const p = pts[i]!;
    sumX.set(r, (sumX.get(r) ?? 0) + p.x);
    sumY.set(r, (sumY.get(r) ?? 0) + p.y);
    cnt.set(r, (cnt.get(r) ?? 0) + 1);
  }

  const cx = new Map<number, number>();
  const cy = new Map<number, number>();
  for (const [r, c] of cnt) {
    cx.set(r, sumX.get(r)! / c);
    cy.set(r, sumY.get(r)! / c);
  }

  for (let i = 0; i < n; i += 1) {
    const r = ufFind(parent, i);
    const x = cx.get(r)!;
    const y = cy.get(r)!;
    pts[i]!.x = x;
    pts[i]!.y = y;
  }

  let k = 0;
  for (const w of walls) {
    w.start = pts[k]!;
    k += 1;
    w.end = pts[k]!;
    k += 1;
  }

  return cloneBuildingModel({ ...model, walls });
}
