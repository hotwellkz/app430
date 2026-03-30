import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';

const COLLECTION_COMPANY_BRANCHES = 'companyBranches';

export interface CompanyBranch {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function normalizeBranchName(name: string): string {
  return (name ?? '').trim();
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function sortBranches(list: CompanyBranch[]): CompanyBranch[] {
  return [...list].sort(
    (a, b) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name, 'ru')
  );
}

export function subscribeCompanyBranches(
  companyId: string,
  callback: (branches: CompanyBranch[]) => void
): Unsubscribe {
  if (!companyId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, COLLECTION_COMPANY_BRANCHES), where('companyId', '==', companyId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          companyId: String(data.companyId ?? companyId),
          name: String(data.name ?? '').trim(),
          isActive: data.isActive !== false,
          sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as CompanyBranch;
      }).filter((b) => b.name.length > 0);
      callback(sortBranches(list));
    },
    () => callback([])
  );
}

export async function ensureDefaultCompanyBranches(companyId: string): Promise<void> {
  if (!companyId) return;
  const q = query(collection(db, COLLECTION_COMPANY_BRANCHES), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  if (!snap.empty) return;
  const defaults = ['Алматы', 'Астана'];
  await Promise.all(
    defaults.map((name, idx) =>
      addDoc(collection(db, COLLECTION_COMPANY_BRANCHES), {
        companyId,
        name,
        isActive: true,
        sortOrder: idx,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    )
  );
}

export async function addCompanyBranch(companyId: string, branchName: string): Promise<CompanyBranch> {
  const normalized = normalizeBranchName(branchName);
  if (!companyId) throw new Error('companyId is required');
  if (!normalized) throw new Error('Введите название филиала');

  const q = query(collection(db, COLLECTION_COMPANY_BRANCHES), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => sameName(String(d.data().name ?? ''), normalized));
  if (existing) {
    const data = existing.data() as Record<string, unknown>;
    if (data.isActive === false) {
      await updateDoc(existing.ref, { name: normalized, isActive: true, updatedAt: serverTimestamp() });
      return {
        id: existing.id,
        companyId,
        name: normalized,
        isActive: true,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0
      };
    }
    throw new Error('Такой филиал уже существует');
  }

  const sortOrder = snap.docs.length;
  const ref = await addDoc(collection(db, COLLECTION_COMPANY_BRANCHES), {
    companyId,
    name: normalized,
    isActive: true,
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: ref.id, companyId, name: normalized, isActive: true, sortOrder };
}

export async function renameCompanyBranch(companyId: string, branchId: string, newName: string): Promise<string> {
  const normalized = normalizeBranchName(newName);
  if (!companyId || !branchId) throw new Error('Некорректные параметры');
  if (!normalized) throw new Error('Введите название филиала');

  const q = query(collection(db, COLLECTION_COMPANY_BRANCHES), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const hasDuplicate = snap.docs.some((d) => d.id !== branchId && sameName(String(d.data().name ?? ''), normalized));
  if (hasDuplicate) throw new Error('Такой филиал уже существует');

  const target = snap.docs.find((d) => d.id === branchId);
  if (!target) throw new Error('Филиал не найден');
  await updateDoc(target.ref, { name: normalized, updatedAt: serverTimestamp() });
  return normalized;
}

export async function archiveCompanyBranch(companyId: string, branchId: string): Promise<void> {
  if (!companyId || !branchId) throw new Error('Некорректные параметры');
  const q = query(collection(db, COLLECTION_COMPANY_BRANCHES), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const target = snap.docs.find((d) => d.id === branchId);
  if (!target) return;
  await updateDoc(target.ref, { isActive: false, updatedAt: serverTimestamp() });
}
