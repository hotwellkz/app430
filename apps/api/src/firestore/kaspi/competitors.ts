import type { KaspiCompetitorSnapshot } from '@2wix/shared-types';
import { competitorsCol } from './collections.js';

function nowIso(): string {
  return new Date().toISOString();
}

export interface AddCompetitorSnapshotInput {
  productId: string;
  companyId: string;
  merchantName: string;
  merchantKaspiId: string;
  price: number;
  city?: string | null;
  deliveryDays?: number | null;
  rating?: number | null;
  isExcluded?: boolean;
}

export async function addCompetitorSnapshot(
  input: AddCompetitorSnapshotInput,
): Promise<KaspiCompetitorSnapshot> {
  const col = competitorsCol(input.productId);
  const ref = col.doc();
  const snapshot: KaspiCompetitorSnapshot = {
    id: ref.id,
    productId: input.productId,
    companyId: input.companyId,
    merchantName: input.merchantName,
    merchantKaspiId: input.merchantKaspiId,
    price: input.price,
    city: input.city ?? null,
    deliveryDays: input.deliveryDays ?? null,
    rating: input.rating ?? null,
    isExcluded: input.isExcluded ?? false,
    parsedAt: nowIso(),
  };
  await ref.set(snapshot);
  return snapshot;
}

/**
 * Последние снапшоты для одного товара (для отображения «конкуренты сейчас»).
 */
export async function getLatestCompetitorSnapshots(
  productId: string,
  limit = 50,
): Promise<KaspiCompetitorSnapshot[]> {
  const snap = await competitorsCol(productId)
    .orderBy('parsedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as KaspiCompetitorSnapshot);
}

/**
 * Снапшоты, созданные за последние N минут (используется репрайсером в шаге 5).
 */
export async function getRecentCompetitorSnapshots(
  productId: string,
  withinMinutes: number,
): Promise<KaspiCompetitorSnapshot[]> {
  const cutoff = new Date(Date.now() - withinMinutes * 60_000).toISOString();
  const snap = await competitorsCol(productId)
    .where('parsedAt', '>=', cutoff)
    .orderBy('parsedAt', 'desc')
    .get();
  return snap.docs.map((d) => d.data() as KaspiCompetitorSnapshot);
}
