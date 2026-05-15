import type { KaspiProduct, KaspiPricingStrategy } from '@2wix/shared-types';
import { productDoc, productsCol } from './collections.js';

function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateKaspiProductInput {
  companyId: string;
  sku: string;
  name: string;
  brand?: string | null;
  kaspiProductUrl: string;
  kaspiProductSlug: string;
  kaspiStoreId?: string | null;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  stepTenge?: number;
  strategy?: KaspiPricingStrategy;
  strategyParam?: KaspiProduct['strategyParam'];
  isActive?: boolean;
}

export async function createKaspiProduct(
  input: CreateKaspiProductInput,
): Promise<KaspiProduct> {
  const ref = productsCol().doc();
  const ts = nowIso();
  const product: KaspiProduct = {
    id: ref.id,
    companyId: input.companyId,
    sku: input.sku,
    name: input.name,
    brand: input.brand ?? null,
    kaspiProductUrl: input.kaspiProductUrl,
    kaspiProductSlug: input.kaspiProductSlug,
    kaspiStoreId: input.kaspiStoreId ?? null,
    currentPrice: input.currentPrice,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    stepTenge: input.stepTenge ?? 1,
    strategy: input.strategy ?? 'undercut_by_step',
    strategyParam: input.strategyParam ?? {},
    isActive: input.isActive ?? true,
    ourPosition: null,
    lastParsedAt: null,
    lastRepricedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set(product);
  return product;
}

export async function getKaspiProduct(id: string): Promise<KaspiProduct | null> {
  const snap = await productDoc(id).get();
  return snap.exists ? (snap.data() as KaspiProduct) : null;
}

export interface ListKaspiProductsFilter {
  companyId: string;
  isActive?: boolean;
  /** Постраничная навигация: курсор — последний id предыдущей страницы. */
  cursorId?: string | null;
  limit?: number;
}

/**
 * Список товаров компании. Без сложных фильтров (поиск/сортировка по
 * пользовательскому полю придёт позже на уровне API/UI; здесь — основа).
 */
export async function listKaspiProducts(
  filter: ListKaspiProductsFilter,
): Promise<KaspiProduct[]> {
  let q = productsCol().where('companyId', '==', filter.companyId);
  if (typeof filter.isActive === 'boolean') {
    q = q.where('isActive', '==', filter.isActive);
  }
  q = q.orderBy('createdAt', 'desc');
  if (filter.cursorId) {
    const cursorSnap = await productDoc(filter.cursorId).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }
  q = q.limit(filter.limit ?? 50);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as KaspiProduct);
}

export type UpdatableProductFields = Partial<
  Pick<
    KaspiProduct,
    | 'name'
    | 'brand'
    | 'kaspiProductUrl'
    | 'kaspiProductSlug'
    | 'kaspiStoreId'
    | 'currentPrice'
    | 'minPrice'
    | 'maxPrice'
    | 'stepTenge'
    | 'strategy'
    | 'strategyParam'
    | 'isActive'
    | 'ourPosition'
    | 'lastParsedAt'
    | 'lastRepricedAt'
  >
>;

export async function updateKaspiProduct(
  id: string,
  patch: UpdatableProductFields,
): Promise<KaspiProduct | null> {
  const ref = productDoc(id);
  const exists = await ref.get();
  if (!exists.exists) return null;
  await ref.update({ ...patch, updatedAt: nowIso() });
  const snap = await ref.get();
  return snap.data() as KaspiProduct;
}

export async function deleteKaspiProduct(id: string): Promise<void> {
  await productDoc(id).delete();
}
