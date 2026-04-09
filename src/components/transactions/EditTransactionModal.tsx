import React, { useState, useMemo } from 'react';
import { Pencil, X } from 'lucide-react';
import type { CategoryCardType } from '../../types';
import type { Transaction } from './types';

export interface EditTransactionModalProps {
  transaction: Transaction;
  peopleAccounts: CategoryCardType[];
  objectAccounts: CategoryCardType[];
  expenseCategories: Array<{ id: string; name: string }>;
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: {
    fromCategoryId: string;
    toCategoryId: string;
    amount: number;
    comment: string;
    auditCategoryId: string | null;
    expenseCategoryId: string | null;
    isSalary: boolean;
    isCashless: boolean;
    needsReview: boolean;
  }) => void;
}

const EXPENSE_ACCOUNT_TITLES = ['Общ Расх', 'Расходы', 'Прочие расходы'];

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  peopleAccounts,
  objectAccounts,
  expenseCategories,
  isSaving,
  onClose,
  onSave
}) => {
  const [fromCategoryId, setFromCategoryId] = useState<string>(() => {
    const match = peopleAccounts.find((c) => c.title === transaction.fromUser);
    return match?.id ?? '';
  });
  const [toCategoryId, setToCategoryId] = useState<string>(() => {
    const target = objectAccounts.find((c) => c.title === transaction.toUser);
    return target?.id ?? '';
  });
  const [amount, setAmount] = useState<string>(Math.abs(transaction.amount).toString());
  const [comment, setComment] = useState<string>(transaction.description);
  const [isSalary, setIsSalary] = useState<boolean>(!!transaction.isSalary);
  const [isCashless, setIsCashless] = useState<boolean>(!!transaction.isCashless);
  const [needsReview, setNeedsReview] = useState<boolean>(!!transaction.needsReview);
  const [auditCategoryId, setAuditCategoryId] = useState<string>(() => {
    const match = peopleAccounts.find((c) => c.title === transaction.fromUser);
    return match?.id ?? '';
  });
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(() => transaction.expenseCategoryId ?? '');
  const [error, setError] = useState<string>('');
  const [toAccountSearch, setToAccountSearch] = useState<string>('');
  const filteredObjectAccounts = useMemo(() => {
    const q = toAccountSearch.trim().toLowerCase();
    if (!q) return objectAccounts;
    return objectAccounts.filter((c) => c.title.toLowerCase().includes(q));
  }, [objectAccounts, toAccountSearch]);

  const selectedToCategory = objectAccounts.find((c) => c.id === toCategoryId);
  const isToExpenseAccount =
    selectedToCategory &&
    (selectedToCategory.type === 'general_expense' || EXPENSE_ACCOUNT_TITLES.includes(selectedToCategory.title));
  const showExpenseCategory = !!isToExpenseAccount;

  const handleSubmit = () => {
    setError('');

    if (!fromCategoryId || !toCategoryId) {
      setError('Выберите счета "Откуда" и "Куда"');
      return;
    }

    if (showExpenseCategory && !expenseCategoryId) {
      setError('Выберите категорию расхода');
      return;
    }

    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    if (!comment.trim()) {
      setError('Введите комментарий');
      return;
    }

    onSave({
      fromCategoryId,
      toCategoryId,
      amount: numericAmount,
      comment: comment.trim(),
      auditCategoryId: auditCategoryId || null,
      expenseCategoryId: showExpenseCategory ? expenseCategoryId || null : null,
      isSalary,
      isCashless,
      needsReview
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Pencil className="w-5 h-5 text-gray-500" />
            Редактирование транзакции
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Откуда (счёт)</label>
              <select
                value={fromCategoryId}
                onChange={(e) => setFromCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите счёт</option>
                {peopleAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Куда (счёт)</label>
              {objectAccounts.length > 8 && (
                <input
                  type="text"
                  value={toAccountSearch}
                  onChange={(e) => setToAccountSearch(e.target.value)}
                  placeholder="Поиск счёта..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-2"
                />
              )}
              <select
                value={toCategoryId}
                onChange={(e) => setToCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите счёт</option>
                {filteredObjectAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showExpenseCategory && (
            <div id="expenseCategoryBlock">
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория расхода</label>
              <select
                id="expenseCategory"
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите категорию</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория (для журнала аудита)</label>
              <select
                value={auditCategoryId}
                onChange={(e) => setAuditCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите человека</option>
                {peopleAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Тип операции</p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6" style={{ minHeight: 36 }}>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={isSalary}
                  onChange={(e) => setIsSalary(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">ЗП</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={isCashless}
                  onChange={(e) => setIsCashless(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Безнал</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]" title="Требует уточнения">
                <input
                  type="checkbox"
                  checked={needsReview}
                  onChange={(e) => setNeedsReview(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Треб.уч.</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
