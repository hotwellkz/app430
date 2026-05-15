import type { Firestore } from 'firebase-admin/firestore';
import { KASPI_COLLECTIONS } from '@2wix/shared-types';
import { getDb } from '../admin.js';

/**
 * Унифицированный доступ к коллекциям модуля Kaspi.
 * Имена путей — только через эти функции, чтобы не плодить строки в разных файлах.
 */

export function db(): Firestore {
  return getDb();
}

export function settingsCol() {
  return db().collection(KASPI_COLLECTIONS.settings);
}

export function settingsDoc(companyId: string) {
  return settingsCol().doc(companyId);
}

export function productsCol() {
  return db().collection(KASPI_COLLECTIONS.products);
}

export function productDoc(productId: string) {
  return productsCol().doc(productId);
}

export function competitorsCol(productId: string) {
  return productDoc(productId).collection(KASPI_COLLECTIONS.competitors);
}

export function priceHistoryCol(productId: string) {
  return productDoc(productId).collection(KASPI_COLLECTIONS.priceHistory);
}

export function excludedMerchantsCol() {
  return db().collection(KASPI_COLLECTIONS.excludedMerchants);
}

export function parseJobsCol() {
  return db().collection(KASPI_COLLECTIONS.parseJobs);
}
