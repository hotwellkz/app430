/**
 * Маршруты, на которых показывается плавающая кнопка ☰ слева (мобильный drawer основного меню).
 * Только экраны транзакций и связанная история — на остальных страницах бургер в шапке страницы / в контенте.
 */
export function isTransactionsFloatingBurgerRoute(pathname: string): boolean {
  if (pathname === '/transactions') return true;
  if (pathname.startsWith('/transactions/')) return true;
  if (pathname.startsWith('/transaction-history/')) return true;
  return false;
}
