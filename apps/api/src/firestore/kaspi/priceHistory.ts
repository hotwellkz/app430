import type { KaspiPriceHistoryEntry } from '@2wix/shared-types';
import { priceHistoryCol } from './collections.js';

function nowIso(): string {
  return new Date().toISOString();
}

export interface AddPriceHistoryInput {
  productId: string;
  companyId: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  triggeredByCompetitorId?: string | null;
}

export async function addPriceHistoryEntry(
  input: AddPriceHistoryInput,
): Promise<KaspiPriceHistoryEntry> {
  const ref = priceHistoryCol(input.productId).doc();
  const entry: KaspiPriceHistoryEntry = {
    id: ref.id,
    productId: input.productId,
    companyId: input.companyId,
    oldPrice: input.oldPrice,
    newPrice: input.newPrice,
    reason: input.reason,
    triggeredByCompetitorId: input.triggeredByCompetitorId ?? null,
    createdAt: nowIso(),
  };
  await ref.set(entry);
  return entry;
}

export async function listPriceHistory(
  productId: string,
  limit = 50,
): Promise<KaspiPriceHistoryEntry[]> {
  const snap = await priceHistoryCol(productId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as KaspiPriceHistoryEntry);
}
