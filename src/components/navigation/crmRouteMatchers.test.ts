import { describe, expect, it } from 'vitest';
import { isTransactionsFloatingBurgerRoute } from './crmRouteMatchers';

describe('isTransactionsFloatingBurgerRoute', () => {
  it('true для /transactions и вложенных путей', () => {
    expect(isTransactionsFloatingBurgerRoute('/transactions')).toBe(true);
    expect(isTransactionsFloatingBurgerRoute('/transactions/history/x')).toBe(true);
  });

  it('true для /transaction-history/...', () => {
    expect(isTransactionsFloatingBurgerRoute('/transaction-history/abc')).toBe(true);
  });

  it('false для WhatsApp, клиентов, ленты', () => {
    expect(isTransactionsFloatingBurgerRoute('/whatsapp')).toBe(false);
    expect(isTransactionsFloatingBurgerRoute('/clients')).toBe(false);
    expect(isTransactionsFloatingBurgerRoute('/feed')).toBe(false);
    expect(isTransactionsFloatingBurgerRoute('/warehouse')).toBe(false);
  });
});
