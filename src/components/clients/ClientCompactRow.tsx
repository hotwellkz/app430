import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Client } from '../../types/client';

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

/**
 * Компактный вид клиента — одна строка: №, имя+фамилия (без отчества),
 * название объекта, иконка-глаз (видимость). Используется в режиме «список»
 * (переключатель Cards / List на странице /clients).
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
  const nameShort = [client.lastName, client.firstName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ') || client.name || '—';

  // Номер — порядковый rowNumber (001, 002, 003 — как в карточках),
  // а не clientNumber из БД (формата «2026-040»).
  const numberLabel = rowNumber ? String(rowNumber).padStart(3, '0') : '';

  const isVisible = client.isIconsVisible !== false;

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
        <span className="flex-shrink-0 font-mono text-[11px] text-gray-400 w-9">{numberLabel}</span>
      )}

      {/* Имя + фамилия */}
      <span className="font-medium text-sm text-gray-900 truncate min-w-0 flex-shrink-0 max-w-[40%]">
        {nameShort}
      </span>

      {/* Объект — растягивается */}
      <span className="flex-1 min-w-0 text-sm text-gray-500 truncate">
        {client.objectName || '—'}
      </span>

      {/* Глаз */}
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
