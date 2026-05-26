import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface TransactionsSearchContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const TransactionsSearchContext = createContext<TransactionsSearchContextValue | null>(null);

export const TransactionsSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo<TransactionsSearchContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <TransactionsSearchContext.Provider value={value}>
      {children}
    </TransactionsSearchContext.Provider>
  );
};

/**
 * Безопасный хук: если провайдера нет (например, в тестах или вне приложения),
 * возвращает no-op значения, чтобы не падать.
 */
export const useTransactionsSearch = (): TransactionsSearchContextValue => {
  const ctx = useContext(TransactionsSearchContext);
  if (ctx) return ctx;
  return {
    isOpen: false,
    open: () => {},
    close: () => {},
    toggle: () => {},
  };
};

/**
 * Имя события для скролла страницы транзакций к конкретной иконке.
 * Слушает Transactions.tsx, диспатчит TransactionsClientSearch.
 */
export const TRANSACTIONS_SCROLL_TO_CATEGORY_EVENT = 'transactions:scroll-to-category';

export interface TransactionsScrollToCategoryDetail {
  categoryId: string;
}
