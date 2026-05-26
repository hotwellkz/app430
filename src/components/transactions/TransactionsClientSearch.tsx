import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MapPin, Phone, Hash, User as UserIcon } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useTransactionsSearch } from '../../contexts/TransactionsSearchContext';
import { Client } from '../../types/client';
import { CategoryCardType } from '../../types';

interface TransactionsClientSearchProps {
  /** Все категории на странице транзакций — нужны, чтобы сматчить клиента с иконкой. */
  categories: CategoryCardType[];
  /** Зовётся при выборе клиента: id найденной иконки или null если иконки нет. */
  onSelectCategory: (categoryId: string | null) => void;
}

interface MatchedClient {
  client: Client;
  category: CategoryCardType | null;
}

function normalize(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().trim();
}

function buildHaystack(c: Client): string {
  return [
    c.firstName,
    c.lastName,
    c.middleName,
    c.name,
    c.phone,
    c.iin,
    c.objectName,
    c.address,
    c.constructionAddress,
    c.livingAddress,
    c.clientNumber,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(' ');
}

/**
 * Поиск иконки проекта (синяя, row=3) по названию объекта клиента.
 * Жёлтую клиентскую иконку (row=1) НЕ возвращаем намеренно — пользователю
 * обычно нужна именно синяя, чтобы провести расход на этот объект.
 * Если иконки-проекта нет — null (показываем notification «нет проекта»).
 */
function matchProjectCategory(
  client: Client,
  categories: CategoryCardType[],
): CategoryCardType | null {
  const target = normalize(client.objectName);
  if (!target) return null;
  return (
    categories.find((c) => c.row === 3 && normalize(c.title) === target) ?? null
  );
}

function clientFullName(c: Client): string {
  const parts = [c.lastName, c.firstName, c.middleName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return c.name || '—';
}

export const TransactionsClientSearch: React.FC<TransactionsClientSearchProps> = ({
  categories,
  onSelectCategory,
}) => {
  const { isOpen, close } = useTransactionsSearch();
  const { clients, loading } = useClients();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Сбрасываем запрос при закрытии. Фокус на input при открытии.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery('');
  }, [isOpen]);

  // Escape — закрыть
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Блокируем скролл фона при открытии
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const results = useMemo<MatchedClient[]>(() => {
    const q = normalize(query);
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const matched: MatchedClient[] = [];
    for (const client of clients) {
      const hay = buildHaystack(client);
      const allMatch = tokens.every((t) => hay.includes(t));
      if (allMatch) {
        matched.push({
          client,
          category: matchProjectCategory(client, categories),
        });
      }
    }

    // Те, у кого есть иконка — наверх (с ними и работают), потом «без иконки»
    matched.sort((a, b) => {
      const aHas = a.category ? 0 : 1;
      const bHas = b.category ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return clientFullName(a.client).localeCompare(clientFullName(b.client), 'ru');
    });

    return matched.slice(0, 50);
  }, [query, clients, categories]);

  const handlePick = (m: MatchedClient) => {
    onSelectCategory(m.category?.id ?? null);
    close();
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[1300] flex items-start justify-center bg-black/50 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Поиск клиента"
    >
      <div
        className={[
          'bg-white flex flex-col w-full overflow-hidden',
          // Мобила: fullscreen с safe-area отступами снизу
          'h-[100dvh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-xl sm:shadow-2xl',
        ].join(' ')}
      >
        {/* Шапка с input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-white">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон, ИИН, объект, адрес, № договора"
            className="flex-1 min-w-0 px-1 py-2 text-base outline-none placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              aria-label="Очистить"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="ml-1 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            aria-label="Закрыть"
          >
            Закрыть
          </button>
        </div>

        {/* Тело: результаты */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!query && (
            <div className="px-4 py-6 text-sm text-gray-500">
              Введите имя клиента, телефон, ИИН, название объекта, адрес стройки
              или номер договора. Поиск ищет по нескольким полям одновременно.
            </div>
          )}

          {query && loading && (
            <div className="px-4 py-6 text-sm text-gray-500">Загрузка...</div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500">
              Ничего не найдено по запросу «{query}».
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y">
              {results.map((m) => (
                <li key={m.client.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(m)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{clientFullName(m.client)}</span>
                          {m.client.clientNumber && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded">
                              <Hash className="w-3 h-3" />
                              {m.client.clientNumber}
                            </span>
                          )}
                        </div>

                        {m.client.objectName && (
                          <div className="mt-0.5 text-[13px] text-gray-700 truncate">
                            Объект:{' '}
                            <span className="font-medium">{m.client.objectName}</span>
                            {m.category ? (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                Проект есть
                              </span>
                            ) : (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                Проекта нет
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          {m.client.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {m.client.phone}
                            </span>
                          )}
                          {(m.client.constructionAddress ||
                            m.client.address ||
                            m.client.livingAddress) && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">
                                {m.client.constructionAddress ||
                                  m.client.address ||
                                  m.client.livingAddress}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
