/**
 * Транзакция ожидает одобрения в ленте (карточка с красным акцентом / бейдж «На рассмотрении»).
 * См. TransactionCard: status === 'pending'.
 */
export function isTransactionPendingApproval(transaction: { status?: string }): boolean {
  return transaction.status === 'pending';
}
