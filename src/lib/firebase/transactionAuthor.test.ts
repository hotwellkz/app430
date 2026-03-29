import { describe, expect, it } from 'vitest';
import {
  buildCreatedByDisplayName,
  emailLocalPart,
  getTransactionAuthorUi
} from './transactionAuthor';

describe('emailLocalPart', () => {
  it('возвращает часть до @', () => {
    expect(emailLocalPart('sabina311298@mail.ru')).toBe('sabina311298');
  });
  it('без @ возвращает строку', () => {
    expect(emailLocalPart('nouser')).toBe('nouser');
  });
});

describe('buildCreatedByDisplayName', () => {
  it('приоритет: name из Firestore', () => {
    expect(
      buildCreatedByDisplayName({
        firestoreName: 'Марго',
        firestoreDisplayName: 'Другое',
        authDisplayName: 'Auth',
        email: 'x@y.com'
      })
    ).toBe('Марго');
  });
  it('fallback: displayName Firestore', () => {
    expect(
      buildCreatedByDisplayName({
        firestoreDisplayName: 'Иван',
        authDisplayName: 'Auth',
        email: 'a@b.c'
      })
    ).toBe('Иван');
  });
  it('fallback: локальная часть email', () => {
    expect(
      buildCreatedByDisplayName({
        email: 'sabina311298@example.com'
      })
    ).toBe('sabina311298');
  });
});

describe('getTransactionAuthorUi', () => {
  it('null если нет данных', () => {
    expect(getTransactionAuthorUi({})).toBeNull();
  });
  it('имя + title с email', () => {
    const r = getTransactionAuthorUi({ createdByName: 'Марго', createdByEmail: 'm@x.com' });
    expect(r?.label).toBe('Марго');
    expect(r?.title).toBe('Марго (m@x.com)');
  });
});
