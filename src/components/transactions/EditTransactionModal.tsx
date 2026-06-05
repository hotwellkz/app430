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

/**
 * Категории в системе живут в трёх «рядах» (row): 1 — клиенты, 2 — сотрудники,
 * 3 — объекты/проекты. Очень часто у клиента и его объекта одно и то же название
 * (например, «BB200Астан»), и в плоском <select> пользователь путается, какую
 * из двух «BB200Астан» он выбрал. Группируем по row через <optgroup>, а у
 * названий, встречающихся в нескольких группах, дописываем хвост ` · Клиент`
 * / ` · Объект` — чтобы и свёрнутый селект показывал, какая именно строка.
 */
const ROW_GROUP_LABEL: Record<number, string> = {
  3: 'Объекты (расход на объект)',
  1: 'Клиенты (приход от клиента)',
  2: 'Сотрудники'
};
const ROW_SHORT_LABEL: Record<number, string> = {
  3: 'Объект',
  1: 'Клиент',
  2: 'Сотрудник'
};
const ROW_ORDER = [3, 1, 2];

interface AccountGroup {
  row: number;
  label: string;
  items: CategoryCardType[];
}

function groupAccountsByRow(accounts: CategoryCardType[]): AccountGroup[] {
  const byRow = new Map<number, CategoryCardType[]>();
  for (const c of accounts) {
    const r = typeof c.row === 'number' ? c.row : 0;
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push(c);
  }
  const groups: AccountGroup[] = [];
  for (const r of ROW_ORDER) {
    const items = byRow.get(r);
    if (items && items.length > 0) {
      groups.push({ row: r, label: ROW_GROUP_LABEL[r], items });
      byRow.delete(r);
    }
  }
  const rest: CategoryCardType[] = [];
  for (const items of byRow.values()) rest.push(...items);
  if (rest.length > 0) groups.push({ row: 0, label: 'Прочее', items: rest });
  return groups;
}

/** Названия, встречающиеся более чем в одной группе — для них дописываем суффикс. */
function buildAmbiguousTitleSet(groups: AccountGroup[]): Set<string> {
  const titleToRows = new Map<string, Set<number>>();
  for (const g of groups) {
    for (const item of g.items) {
      const key = item.title.trim().toLowerCase();
      if (!titleToRows.has(key)) titleToRows.set(key, new Set());
      titleToRows.get(key)!.add(g.row);
    }
  }
  const ambiguous = new Set<string>();
  for (const [title, rows] of titleToRows.entries()) {
    if (rows.size > 1) ambiguous.add(title);
  }
  return ambiguous;
}

interface GroupedSelectOptionsProps {
  groups: AccountGroup[];
  ambiguousTitles: Set<string>;
}

const GroupedSelectOptions: React.FC<GroupedSelectOptionsProps> = ({ groups, ambiguousTitles }) => (
  <>
    {groups.map((g) => (
      <optgroup key={g.row} label={g.label}>
        {g.items.map((c) => {
          const isAmbiguous = ambiguousTitles.has(c.title.trim().toLowerCase());
          const suffix = isAmbiguous && ROW_SHORT_LABEL[g.row] ? ` · ${ROW_SHORT_LABEL[g.row]}` : '';
          return (
            <option key={c.id} value={c.id}>
              {c.title}{suffix}
            </option>
          );
        })}
      </optgroup>
    ))}
  </>
);

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

  const toAccountGroups = useMemo(() => groupAccountsByRow(filteredObjectAccounts), [filteredObjectAccounts]);
  const toAccountAmbiguous = useMemo(() => buildAmbiguousTitleSet(toAccountGroups), [toAccountGroups]);
  const fromAccountGroups = useMemo(() => groupAccountsByRow(peopleAccounts), [peopleAccounts]);
  const fromAccountAmbiguous = useMemo(() => buildAmbiguousTitleSet(fromAccountGroups), [fromAccountGroups]);

  const selectedToCategory = objectAccounts.find((c) => c.id === toCategoryId);
  const selectedToCategoryRow = typeof selectedToCategory?.row === 'number' ? selectedToCategory.row : 0;
  const selectedToShortLabel = ROW_SHORT_LABEL[selectedToCategoryRow];
  const TO_BADGE_BY_ROW: Record<number, string> = {
    1: 'bg-amber-50 text-amber-700 border-amber-200',
    2: 'bg-gray-50 text-gray-700 border-gray-200',
    3: 'bg-blue-50 text-blue-700 border-blue-200'
  };
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
                <GroupedSelectOptions groups={fromAccountGroups} ambiguousTitles={fromAccountAmbiguous} />
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
                <GroupedSelectOptions groups={toAccountGroups} ambiguousTitles={toAccountAmbiguous} />
              </select>
              {selectedToCategory && selectedToShortLabel && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  <span className="text-gray-500">Это:</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${
                      TO_BADGE_BY_ROW[selectedToCategoryRow] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {selectedToShortLabel}
                  </span>
                </div>
              )}
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
                <GroupedSelectOptions groups={fromAccountGroups} ambiguousTitles={fromAccountAmbiguous} />
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
