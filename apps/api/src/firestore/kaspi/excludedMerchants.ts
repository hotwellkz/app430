import type { KaspiExcludedMerchant } from '@2wix/shared-types';
import { excludedMerchantsCol } from './collections.js';

function nowIso(): string {
  return new Date().toISOString();
}

export interface AddExcludedMerchantInput {
  companyId: string;
  merchantKaspiId: string;
  merchantName: string;
  reason?: string | null;
}

export async function addExcludedMerchant(
  input: AddExcludedMerchantInput,
): Promise<KaspiExcludedMerchant> {
  const ref = excludedMerchantsCol().doc();
  const record: KaspiExcludedMerchant = {
    id: ref.id,
    companyId: input.companyId,
    merchantKaspiId: input.merchantKaspiId,
    merchantName: input.merchantName,
    reason: input.reason ?? null,
    createdAt: nowIso(),
  };
  await ref.set(record);
  return record;
}

export async function listExcludedMerchants(
  companyId: string,
): Promise<KaspiExcludedMerchant[]> {
  const snap = await excludedMerchantsCol()
    .where('companyId', '==', companyId)
    .get();
  return snap.docs.map((d) => d.data() as KaspiExcludedMerchant);
}

export async function removeExcludedMerchant(id: string): Promise<void> {
  await excludedMerchantsCol().doc(id).delete();
}

/** Быстрая проверка для репрайсера: множество merchantKaspiId, исключённых для компании. */
export async function getExcludedMerchantIdsSet(
  companyId: string,
): Promise<Set<string>> {
  const list = await listExcludedMerchants(companyId);
  return new Set(list.map((m) => m.merchantKaspiId));
}
