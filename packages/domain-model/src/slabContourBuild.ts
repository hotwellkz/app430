import type { BuildingModel, Point2D, Wall } from '@2wix/shared-types';
import { isExternalWallForFoundation, orderExternalWallsInRing } from './foundationOuterWallLoop.js';
import { polygonAreaSigned, polygonSelfIntersects, offsetClosedPolygonOutward, buildOuterSipRing } from './foundationStripBuild.js';
import { getWallsByFloor } from './wallOps.js';

const MIN_SLAB_AREA_MM2 = 250_000; // 0.25 m²

/**
 * Контур плиты перекрытия по наружному кольцу стен: внутрь от наружного SIP-контура
 * на половину средней толщины стен (упрощённая «комната» в плане).
 */
export function buildSlabDeckContourFromExternalWalls(
  model: BuildingModel,
  floorId: string
):
  | { ok: true; contourMm: Point2D[]; basedOnWallIds: string[] }
  | { ok: false; reason: string } {
  const floorWalls = getWallsByFloor(model, floorId);
  const external = floorWalls.filter((w) => isExternalWallForFoundation(w));
  if (external.length < 3) {
    return { ok: false, reason: 'Нужно минимум три наружные стены для контура перекрытия' };
  }

  const ring = orderExternalWallsInRing(external);
  if (!ring.ok) {
    return { ok: false, reason: ring.reason };
  }

  const byId = new Map(floorWalls.map((w) => [w.id, w]));
  const ordered: Wall[] = ring.ids.map((id) => byId.get(id)).filter((w): w is Wall => Boolean(w));
  if (ordered.length !== ring.ids.length) {
    return { ok: false, reason: 'Не найдены стены контура перекрытия' };
  }

  const sip = buildOuterSipRing(ordered);
  if (sip.length < 3) {
    return { ok: false, reason: 'Некорректный контур SIP для перекрытия' };
  }

  let sipCCW = polygonAreaSigned(sip) < 0 ? [...sip].reverse() : sip;

  if (polygonSelfIntersects(sipCCW)) {
    return { ok: false, reason: 'Контур перекрытия самопересекается' };
  }

  const area = Math.abs(polygonAreaSigned(sipCCW));
  if (area < MIN_SLAB_AREA_MM2) {
    return { ok: false, reason: 'Площадь контура перекрытия слишком мала' };
  }

  const halfAvg =
    ordered.reduce((s, w) => s + w.thicknessMm, 0) / Math.max(1, 2 * ordered.length);

  let deck = offsetClosedPolygonOutward(sipCCW, -halfAvg);
  const deckArea = Math.abs(polygonAreaSigned(deck));
  if (deckArea <= 0 || polygonSelfIntersects(deck) || deck.length < 3) {
    deck = sipCCW.map((p) => ({ ...p }));
  }

  return { ok: true, contourMm: deck, basedOnWallIds: [...ring.ids] };
}
