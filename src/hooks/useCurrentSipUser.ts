import { useAuth } from './useAuth';

/**
 * UID текущего пользователя CRM для заголовка x-sip-user-id и deep link в SIP Editor.
 */
export function useCurrentSipUser() {
  const { user, loading } = useAuth();
  return {
    sipUserId: user?.uid ?? null,
    loading,
    isAuthenticated: Boolean(user?.uid),
  };
}
