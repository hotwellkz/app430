import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './config';

/** Снимок автора на момент создания транзакции (плоские поля в документе Firestore). */
export interface TransactionCreatedBySnapshot {
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
}

const SYSTEM_UID = '__system__';

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Часть email до @; если @ нет — вся строка. */
export function emailLocalPart(email: string): string {
  const t = email.trim();
  const at = t.indexOf('@');
  if (at <= 0) return t;
  return t.slice(0, at) || t;
}

/**
 * Короткое имя для snapshot: users.name → users.displayName → auth.displayName → локальная часть email → email.
 * Используется только при записи из клиента на основе Auth + users/{uid} (не доверяем произвольному вводу).
 */
export function buildCreatedByDisplayName(params: {
  firestoreName?: string | null;
  firestoreDisplayName?: string | null;
  authDisplayName?: string | null;
  email: string;
}): string {
  const profile =
    trimStr(params.firestoreName) ||
    trimStr(params.firestoreDisplayName) ||
    '';
  const authDn = trimStr(params.authDisplayName);
  const em = trimStr(params.email);
  const local = em ? emailLocalPart(em) : '';
  return profile || authDn || local || em || 'Пользователь';
}

/** Для автоматических операций без пользователя (опционально). */
export function transactionCreatedBySystemSnapshot(): TransactionCreatedBySnapshot {
  return {
    createdByUid: SYSTEM_UID,
    createdByName: 'Система',
    createdByEmail: ''
  };
}

/**
 * Текущий залогиненный пользователь + профиль users/{uid}.
 * Возвращает null, если нет auth-сессии.
 */
export async function resolveTransactionCreatedBySnapshot(): Promise<TransactionCreatedBySnapshot | null> {
  const u = auth.currentUser;
  if (!u?.uid) return null;

  let firestoreName: string | null = null;
  let firestoreDisplayName: string | null = null;
  let email = trimStr(u.email);

  try {
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (snap.exists()) {
      const d = snap.data();
      firestoreName = trimStr(d.name) || null;
      firestoreDisplayName = trimStr(d.displayName) || null;
      if (!email) email = trimStr(d.email);
    }
  } catch {
    // профиль недоступен — остаются данные Auth
  }

  const createdByName = buildCreatedByDisplayName({
    firestoreName,
    firestoreDisplayName,
    authDisplayName: u.displayName,
    email: email || trimStr(u.email)
  });

  return {
    createdByUid: u.uid,
    createdByName,
    createdByEmail: email || trimStr(u.email)
  };
}

/** Для spread в объект документа; пустой объект, если автора нет. */
export function spreadCreatedBy(snapshot: TransactionCreatedBySnapshot | null | undefined): Record<string, string> {
  if (!snapshot) return {};
  return {
    createdByUid: snapshot.createdByUid,
    createdByName: snapshot.createdByName,
    createdByEmail: snapshot.createdByEmail
  };
}

/** Метка и title для карточки (старые документы без полей — null). */
export function getTransactionAuthorUi(transaction: {
  createdByName?: string | null;
  createdByEmail?: string | null;
}): { label: string; title: string } | null {
  const name = trimStr(transaction.createdByName);
  const emailFull = trimStr(transaction.createdByEmail);
  if (name) {
    return { label: name, title: emailFull ? `${name} (${emailFull})` : name };
  }
  if (emailFull) {
    const short = emailLocalPart(emailFull);
    return { label: short || emailFull, title: emailFull };
  }
  return null;
}
