import React from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';

export interface TransactionEditPasswordModalProps {
  isOpen: boolean;
  password: string;
  error: string;
  onPasswordChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  /** По умолчанию — текст как в Ленте */
  description?: string;
}

export const TransactionEditPasswordModal: React.FC<TransactionEditPasswordModalProps> = ({
  isOpen,
  password,
  error,
  onPasswordChange,
  onClose,
  onSubmit,
  description = 'Введите пароль для включения режима редактирования операций.'
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
      onClick={() => {
        onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" />
            Режим редактирования
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            onPasswordChange(e.target.value);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          placeholder="Пароль"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600"
          >
            Войти
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
