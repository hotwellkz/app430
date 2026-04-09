import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { CategoryCardType } from '../../types';
import { editFeedTransaction } from '../../lib/firebase/transactions';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import type { Transaction } from './types';
import type { TransactionCardTransaction } from './TransactionCard';
import { TransferModal } from './transfer/TransferModal';
import { EditTransactionModal } from './EditTransactionModal';

function isFuelTransactionLike(
  tx: Pick<Transaction, 'toUser' | 'fuelData' | 'expenseCategoryId'>,
  expenseCategoryById: Map<string, { name: string; color?: string }>
): boolean {
  if (tx.fuelData) return true;
  if ((tx.toUser || '').trim().toLowerCase() === 'заправка') return true;
  if (tx.expenseCategoryId) {
    const expName = expenseCategoryById.get(tx.expenseCategoryId)?.name?.trim().toLowerCase();
    if (expName === 'заправка') return true;
  }
  return false;
}

export interface TransactionEditModalsProps {
  editingTransaction: TransactionCardTransaction | null;
  onCloseEditing: () => void;
  isSavingEdit: boolean;
  setIsSavingEdit: (v: boolean) => void;
  employeeCategories: CategoryCardType[];
  visibleCategories: CategoryCardType[];
  expenseCategories: Array<{ id: string; name: string }>;
  expenseCategoryById: Map<string, { name: string; color?: string }>;
  /** Сразу убрать отменённые id из локального списка (Лента / История). */
  onRemovedAfterEdit: (transactionIds: string[]) => void;
}

/**
 * Общие модалки редактирования (заправка через TransferModal, остальное — EditTransactionModal).
 * Используются на Ленте и на странице истории счёта.
 */
export const TransactionEditModals: React.FC<TransactionEditModalsProps> = ({
  editingTransaction,
  onCloseEditing,
  isSavingEdit,
  setIsSavingEdit,
  employeeCategories,
  visibleCategories,
  expenseCategories,
  expenseCategoryById,
  onRemovedAfterEdit
}) => {
  const fuelEditSourceCategory = useMemo(
    () => (editingTransaction ? employeeCategories.find((c) => c.title === editingTransaction.fromUser) : undefined),
    [editingTransaction, employeeCategories]
  );
  const fuelEditTargetCategory = useMemo(
    () => (editingTransaction ? visibleCategories.find((c) => c.title === editingTransaction.toUser) : undefined),
    [editingTransaction, visibleCategories]
  );

  const isFuelEditingTransaction = useMemo(
    () => !!editingTransaction && isFuelTransactionLike(editingTransaction, expenseCategoryById),
    [editingTransaction, expenseCategoryById]
  );

  useEffect(() => {
    if (!editingTransaction || !isFuelEditingTransaction) return;
    if (fuelEditSourceCategory && fuelEditTargetCategory) return;
    showErrorNotification('Не удалось определить счета для редактирования заправки');
    onCloseEditing();
  }, [editingTransaction, isFuelEditingTransaction, fuelEditSourceCategory, fuelEditTargetCategory, onCloseEditing]);

  if (!editingTransaction) return null;

  if (isFuelEditingTransaction && (!fuelEditSourceCategory || !fuelEditTargetCategory)) {
    return null;
  }

  if (isFuelEditingTransaction && fuelEditSourceCategory && fuelEditTargetCategory) {
    return createPortal(
      <TransferModal
        sourceCategory={fuelEditSourceCategory}
        targetCategory={fuelEditTargetCategory}
        isOpen
        mode="edit"
        title="Редактирование заправки"
        submitLabel="Сохранить"
        initialValues={{
          amount: Math.abs(editingTransaction.amount),
          description: editingTransaction.description,
          isSalary: !!editingTransaction.isSalary,
          isCashless: !!editingTransaction.isCashless,
          needsReview: !!editingTransaction.needsReview,
          expenseCategoryId: editingTransaction.expenseCategoryId,
          attachments: (() => {
            const txAny = editingTransaction as unknown as {
              attachments?: Array<{ name?: string; url?: string; type?: string; size?: number; path?: string }>;
              files?: Array<{ name?: string; url?: string; type?: string; size?: number; path?: string }>;
              attachmentUrl?: string;
              fileUrl?: string;
              receiptImage?: string;
              fuelData?: { receiptFileUrl?: string | null; receiptRef?: string | null };
            };
            const list = (Array.isArray(txAny.attachments) ? txAny.attachments : []).concat(
              Array.isArray(txAny.files) ? txAny.files : []
            );
            const singleUrl =
              txAny.attachmentUrl ||
              txAny.fileUrl ||
              txAny.receiptImage ||
              txAny.fuelData?.receiptFileUrl ||
              null;
            if (singleUrl) {
              list.push({
                name: 'Чек',
                url: singleUrl,
                type: 'image/jpeg',
                path: txAny.fuelData?.receiptRef ?? undefined
              });
            }
            const uniqueByUrl = new Map<string, { name: string; url: string; type?: string; size?: number; path?: string }>();
            list.forEach((item) => {
              const url = typeof item?.url === 'string' ? item.url.trim() : '';
              if (!url) return;
              if (!uniqueByUrl.has(url)) {
                uniqueByUrl.set(url, {
                  name: item?.name || 'Чек',
                  url,
                  type: item?.type,
                  size: typeof item?.size === 'number' ? item.size : undefined,
                  path: item?.path
                });
              }
            });
            return Array.from(uniqueByUrl.values());
          })(),
          fuelData: editingTransaction.fuelData
            ? {
                vehicleId: editingTransaction.fuelData.vehicleId,
                odometerKm: editingTransaction.fuelData.odometerKm,
                liters: editingTransaction.fuelData.liters ?? null,
                pricePerLiter: editingTransaction.fuelData.pricePerLiter ?? null,
                fuelType: editingTransaction.fuelData.fuelType ?? null,
                gasStation: editingTransaction.fuelData.gasStation ?? null,
                isFullTank: !!editingTransaction.fuelData.isFullTank
              }
            : undefined
        }}
        onClose={() => {
          if (isSavingEdit) return;
          onCloseEditing();
        }}
        onSubmitData={async (payload) => {
          if (isSavingEdit) return;
          try {
            setIsSavingEdit(true);
            await editFeedTransaction({
              originalTransactionId: editingTransaction.id,
              newFromCategory: fuelEditSourceCategory,
              newToCategory: fuelEditTargetCategory,
              newAmount: payload.amount,
              newDescription: payload.description,
              newExpenseCategoryId: payload.expenseCategoryId,
              newIsSalary: payload.isSalary,
              newIsCashless: payload.isCashless,
              newNeedsReview: payload.needsReview,
              newAttachments: payload.attachments,
              newFuelData: payload.fuelData,
              audit: {
                transactionId: editingTransaction.id,
                before: {
                  from: editingTransaction.fromUser,
                  to: editingTransaction.toUser,
                  amount: editingTransaction.amount,
                  comment: editingTransaction.description,
                  category: editingTransaction.fromUser || null,
                  isSalary: !!editingTransaction.isSalary,
                  isCashless: !!editingTransaction.isCashless,
                  needsReview: !!editingTransaction.needsReview
                },
                after: {
                  from: fuelEditSourceCategory.title,
                  to: fuelEditTargetCategory.title,
                  amount: payload.amount,
                  comment: payload.description,
                  category: fuelEditSourceCategory.title,
                  isSalary: payload.isSalary,
                  isCashless: payload.isCashless,
                  needsReview: payload.needsReview
                }
              }
            });
            onRemovedAfterEdit([editingTransaction.id]);
            onCloseEditing();
          } catch (error) {
            console.error('Error editing fuel transaction:', error);
            showErrorNotification(error instanceof Error ? error.message : 'Ошибка при редактировании заправки');
            throw error;
          } finally {
            setIsSavingEdit(false);
          }
        }}
      />,
      document.body
    );
  }

  return (
    <EditTransactionModal
      transaction={editingTransaction as Transaction}
      peopleAccounts={employeeCategories}
      objectAccounts={visibleCategories}
      expenseCategories={expenseCategories}
      isSaving={isSavingEdit}
      onClose={() => {
        if (isSavingEdit) return;
        onCloseEditing();
      }}
      onSave={async (updated) => {
        if (isSavingEdit) return;
        try {
          setIsSavingEdit(true);

          const newFromCategory = employeeCategories.find((c) => c.id === updated.fromCategoryId);
          const newToCategory = visibleCategories.find((c) => c.id === updated.toCategoryId);
          const afterAuditCategory = employeeCategories.find((c) => c.id === updated.auditCategoryId);

          if (!newFromCategory || !newToCategory) {
            throw new Error('Не удалось найти выбранные счета');
          }

          await editFeedTransaction({
            originalTransactionId: editingTransaction.id,
            newFromCategory,
            newToCategory,
            newAmount: updated.amount,
            newDescription: updated.comment,
            newExpenseCategoryId: updated.expenseCategoryId ?? undefined,
            newIsSalary: updated.isSalary,
            newIsCashless: updated.isCashless,
            newNeedsReview: updated.needsReview,
            audit: {
              transactionId: editingTransaction.id,
              before: {
                from: editingTransaction.fromUser,
                to: editingTransaction.toUser,
                amount: editingTransaction.amount,
                comment: editingTransaction.description,
                category: editingTransaction.fromUser || null,
                isSalary: !!editingTransaction.isSalary,
                isCashless: !!editingTransaction.isCashless,
                needsReview: !!editingTransaction.needsReview
              },
              after: {
                from: newFromCategory.title,
                to: newToCategory.title,
                amount: updated.amount,
                comment: updated.comment,
                category: afterAuditCategory?.title ?? null,
                isSalary: updated.isSalary,
                isCashless: updated.isCashless,
                needsReview: updated.needsReview
              }
            }
          });

          showSuccessNotification('Транзакция успешно отредактирована');
          onRemovedAfterEdit([editingTransaction.id]);
          onCloseEditing();
        } catch (error) {
          console.error('Error editing transaction:', error);
          showErrorNotification(error instanceof Error ? error.message : 'Ошибка при редактировании транзакции');
        } finally {
          setIsSavingEdit(false);
        }
      }}
    />
  );
};
