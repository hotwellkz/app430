import { useState, useEffect, useCallback } from 'react';
import { showSuccessNotification } from '../utils/notifications';

const SESSION_KEY = 'feed-edit-mode';

export interface UseTransactionEditModeResult {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  showPasswordModal: boolean;
  setShowPasswordModal: (v: boolean) => void;
  editPassword: string;
  setEditPassword: (v: string) => void;
  editPasswordError: string;
  setEditPasswordError: (v: string) => void;
  openEditModeOrPrompt: () => void;
  disableEditMode: () => void;
  submitPassword: () => void;
}

/**
 * Общий режим редактирования транзакций (Лента и История операций).
 * Состояние «включён» хранится в sessionStorage — действует в рамках вкладки до закрытия.
 */
export function useTransactionEditMode(): UseTransactionEditModeResult {
  const [editMode, setEditModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(SESSION_KEY) === 'true';
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordError, setEditPasswordError] = useState('');

  const setEditMode = useCallback((v: boolean) => {
    setEditModeState(v);
    if (typeof window !== 'undefined') {
      if (v) {
        window.sessionStorage.setItem(SESSION_KEY, 'true');
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY && e.storageArea === window.sessionStorage) {
        setEditModeState(window.sessionStorage.getItem(SESSION_KEY) === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const openEditModeOrPrompt = useCallback(() => {
    if (editMode) return;
    setShowPasswordModal(true);
    setEditPassword('');
    setEditPasswordError('');
  }, [editMode]);

  const disableEditMode = useCallback(() => {
    setEditMode(false);
  }, [setEditMode]);

  const submitPassword = useCallback(() => {
    const envPassword = import.meta.env.VITE_FEED_EDIT_PASSWORD;
    if (!envPassword) {
      setEditPasswordError('Пароль не настроен в окружении (VITE_FEED_EDIT_PASSWORD)');
      return;
    }
    if (editPassword !== envPassword) {
      setEditPasswordError('Неверный пароль');
      return;
    }
    setEditMode(true);
    setShowPasswordModal(false);
    setEditPassword('');
    setEditPasswordError('');
    showSuccessNotification('Режим редактирования включён');
  }, [editPassword, setEditMode]);

  return {
    editMode,
    setEditMode,
    showPasswordModal,
    setShowPasswordModal,
    editPassword,
    setEditPassword,
    editPasswordError,
    setEditPasswordError,
    openEditModeOrPrompt,
    disableEditMode,
    submitPassword
  };
}
