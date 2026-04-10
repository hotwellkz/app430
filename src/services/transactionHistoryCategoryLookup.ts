import {
  collection,
  getDocs,
  limit,
  query,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client } from '../types/client';
import type { Transaction } from '../components/transactions/types';
import { getClientAggregates } from '../utils/clientAggregates';

export type TransactionHistoryScope = 'client' | 'project';

export interface GetTransactionHistoryCategoryIdInput {
  scope: TransactionHistoryScope;
  companyId: string;
  client: Client;
}

function logDev(message: string, payload: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.info(`[transactionHistoryLookup] ${message}`, payload);
  }
}

function matchesTransactionToClient(
  transaction: Transaction,
  client: Client
): boolean {
  const clientName = `${client.lastName || ''} ${client.firstName || ''}`.trim();
  return Boolean(
    (client.lastName && transaction.toUser?.includes(client.lastName)) ||
      (client.firstName && transaction.toUser?.includes(client.firstName)) ||
      (client.objectName && transaction.description?.includes(client.objectName)) ||
      (clientName && transaction.description?.includes(clientName))
  );
}

/**
 * Находит документ категории (счёт клиента row=1 или проекта row=3) по objectName / ФИО,
 * с разруливанием дубликатов по одной транзакции.
 */
async function resolveCategoryIdByTitles(
  companyId: string,
  row: 1 | 3,
  client: Client
): Promise<string | null> {
  let categoryId: string | null = null;

  if (client.objectName) {
    const objectNameQuery = query(
      collection(db, 'categories'),
      where('companyId', '==', companyId),
      where('title', '==', client.objectName),
      where('row', '==', row)
    );
    const objectNameSnapshot = await getDocs(objectNameQuery);

    if (objectNameSnapshot.docs.length === 1) {
      categoryId = objectNameSnapshot.docs[0].id;
    } else if (objectNameSnapshot.docs.length > 1) {
      for (const categoryDoc of objectNameSnapshot.docs) {
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('companyId', '==', companyId),
          where('categoryId', '==', categoryDoc.id),
          limit(1)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);

        if (!transactionsSnapshot.empty) {
          const transaction = transactionsSnapshot.docs[0].data() as Transaction;
          if (matchesTransactionToClient(transaction, client)) {
            categoryId = categoryDoc.id;
            break;
          }
        }
      }

      if (!categoryId) {
        categoryId = objectNameSnapshot.docs[0].id;
      }
    }
  }

  if (!categoryId) {
    const clientName = `${client.lastName || ''} ${client.firstName || ''}`.trim();
    if (clientName) {
      const nameQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', companyId),
        where('title', '==', clientName),
        where('row', '==', row)
      );
      const nameSnapshot = await getDocs(nameQuery);

      if (nameSnapshot.docs.length === 1) {
        categoryId = nameSnapshot.docs[0].id;
      } else if (nameSnapshot.docs.length > 1) {
        for (const categoryDoc of nameSnapshot.docs) {
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('companyId', '==', companyId),
            where('categoryId', '==', categoryDoc.id),
            limit(1)
          );
          const transactionsSnapshot = await getDocs(transactionsQuery);

          if (!transactionsSnapshot.empty) {
            const transaction = transactionsSnapshot.docs[0].data() as Transaction;
            if (matchesTransactionToClient(transaction, client)) {
              categoryId = categoryDoc.id;
              break;
            }
          }
        }

        if (!categoryId) {
          categoryId = nameSnapshot.docs[0].id;
        }
      }
    }
  }

  return categoryId;
}

/**
 * Возвращает categoryId для маршрута /transactions/history/:id.
 * Для scope=client сначала clientAggregates.categoryId (стабильная привязка к документу клиента).
 */
/** Краткий текст для toast/UI: в prod не показываем «пустую» ошибку без смысла. */
export function formatTransactionHistoryErrorForUser(err: unknown, devDetail: boolean): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (devDetail) {
    return msg;
  }
  if (/failed-precondition/i.test(msg) && /index/i.test(msg)) {
    return 'Ошибка Firestore: для запроса нужен составной индекс. Откройте консоль браузера — там есть ссылка от Firebase.';
  }
  const first = msg.split('\n')[0] ?? msg;
  return first.length > 180 ? `${first.slice(0, 177)}…` : first;
}

export async function getTransactionHistoryCategoryId(
  input: GetTransactionHistoryCategoryIdInput
): Promise<string | null> {
  const { scope, companyId, client } = input;

  if (scope === 'client') {
    const aggregates = await getClientAggregates(client.id);
    if (aggregates?.categoryId) {
      logDev('resolved via clientAggregates', {
        scope,
        clientDocId: client.id,
        categoryId: aggregates.categoryId
      });
      return aggregates.categoryId;
    }
  }

  const row = scope === 'client' ? 1 : 3;
  const categoryId = await resolveCategoryIdByTitles(companyId, row, client);

  logDev('resolved via title queries', {
    scope,
    row,
    clientDocId: client.id,
    clientNumber: client.clientNumber,
    objectName: client.objectName,
    categoryId
  });

  return categoryId;
}

/** Alias: `getTransactionHistory({ scope, companyId, client })` → categoryId для `/transactions/history/:id`. */
export const getTransactionHistory = getTransactionHistoryCategoryId;
