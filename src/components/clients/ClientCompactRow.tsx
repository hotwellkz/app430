import React from 'react';
import { Eye, EyeOff, Phone, MapPin, CalendarDays } from 'lucide-react';
import { Client } from '../../types/client';
import { ClientActions } from './ClientActions';

interface ClientCompactRowProps {
  client: Client;
  rowNumber?: number;
  /** Тип секции — определяет цвет левой полоски. */
  type?: 'building' | 'deposit' | 'built';
  onClientClick: (client: Client) => void;
  onContextMenu: (e: React.MouseEvent, client: Client) => void;
  onToggleVisibility: (client: Client) => Promise<void>;
}

/** Цвет border-left по типу секции (как в ClientCard: эмеральд / амбер / синий). */
const BORDER_BY_TYPE: Record<NonNullable<ClientCompactRowProps['type']>, string> = {
  building: 'border-l-emerald-500',
  deposit: 'border-l-amber-500',
  built: 'border-l-blue-500',
};

function formatStartDate(startDate?: string): string | null {
  if (!startDate) return null;
  // Ожидаем формат YYYY-MM-DD; обрезаем до DD.MM.YY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDate);
  if (!m) return startDate;
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}

/**
 * Компактный вид клиента — одна строка. На ПК показывает максимум информации:
 * № • ФИ • телефон • адрес стройки (truncate) • дата старта • объект • иконки действий • глаз.
 * На мобиле скрываются дополнительные колонки через `hidden md:inline` и т.п.
 */
export const ClientCompactRow: React.FC<ClientCompactRowProps> = ({
  client,
  rowNumber,
  type = 'building',
  onClientClick,
  onContextMenu,
  onToggleVisibility,
}) => {
  const borderClass = BORDER_BY_TYPE[type];

  // ФИ без отчества
  const nameShort =
    [client.lastName, client.firstName]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' ') || client.name || '—';

  // Порядковый номер 001 (как в карточках)
  const numberLabel = rowNumber ? String(rowNumber).padStart(3, '0') : '';

  const isVisible = client.isIconsVisible !== false;
  const phone = client.phone?.trim();
  const address = client.constructionAddress?.trim() || client.address?.trim();
  const startDate = formatStartDate(client.startDate);

  const handleVisibilityClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onToggleVisibility(client);
  };

  return (
    <div
      onClick={() => onClientClick(client)}
      onContextMenu={(e) => onContextMenu(e, client)}
      className={`flex items-center gap-2 px-3 py-1.5 bg-white border-l-4 ${borderClass} rounded-md hover:bg-gray-50 cursor-pointer transition-colors`}
    >
      {/* Номер */}
      {numberLabel && (
        <span className="flex-shrink-0 font-mono text-[11px] text-gray-400 w-9">
          {numberLabel}
        </span>
      )}

      {/* Имя + Фамилия */}
      <span className="font-medium text-sm text-gray-900 truncate flex-shrink-0 max-w-[28%]">
        {nameShort}
      </span>

      {/* Телефон — md+ */}
      {phone && (
        <span className="hidden md:inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          <Phone className="w-3 h-3" aria-hidden />
          {phone}
        </span>
      )}

      {/* Адрес стройки — lg+, truncate */}
      {address && (
        <span className="hidden lg:inline-flex items-center gap-1 text-xs text-gray-500 truncate min-w-0 max-w-[18%]">
          <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden />
          <span className="truncate">{address}</span>
        </span>
      )}

      {/* Дата старта — xl+ */}
      {startDate && (
        <span className="hidden xl:inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          <CalendarDays className="w-3 h-3" aria-hidden />
          {startDate}
        </span>
      )}

      {/* Объект — растягивается, truncate */}
      <span className="flex-1 min-w-0 text-sm text-gray-500 truncate">
        {client.objectName || '—'}
      </span>

      {/* Иконки действий: комментарии, история проекта/клиента, экспорт, отчёт */}
      <div className="flex-shrink-0">
        <ClientActions
          client={client}
          size="sm"
          stopPropagation
          allowWrap={false}
          compactOnMobile
        />
      </div>

      {/* Глаз — справа */}
      <button
        type="button"
        onClick={handleVisibilityClick}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        title={isVisible ? 'Скрыть иконки' : 'Показать иконки'}
        aria-label={isVisible ? 'Скрыть иконки' : 'Показать иконки'}
      >
        {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
};
