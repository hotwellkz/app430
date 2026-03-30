import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import { buildConsistentCityBranch, getRegulatedCitiesList, normalizeCityToCanonical, resolveBranchNameByCity } from './cityBranchRegulation';

const COLLECTION_COMPANY_CITIES = 'companyCities';
const COLLECTION_CLIENTS = 'clients';

/** Нормализация для отображения: trim + первый символ в верхний регистр, остальные в нижний (по словам). */
export function normalizeCityDisplay(name: string): string {
  const canonical = normalizeCityToCanonical(name);
  if (canonical) return canonical;
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Проверка дубликата без учёта регистра и пробелов. */
function sameCity(a: string, b: string): boolean {
  const ca = normalizeCityToCanonical(a) ?? a;
  const cb = normalizeCityToCanonical(b) ?? b;
  return ca.trim().toLowerCase() === cb.trim().toLowerCase();
}

/**
 * Нормализация сырого названия города из AI: trim, убрать префикс "г.", привести к виду для сравнения.
 */
export function normalizeDetectedCity(raw: string): string {
  const t = (raw ?? '').trim().replace(/^\s*г\.?\s*/i, '').trim();
  const canonical = normalizeCityToCanonical(t);
  return canonical ?? normalizeCityDisplay(t);
}

/**
 * Определить, можно ли автоматически подставить город в карточку после AI-анализа.
 * Возвращает каноническое название города из справочника или null.
 * Правила: не перезаписывать ручной выбор; только если город есть в справочнике; двусмысленность не подставляем.
 */
export function resolveCityForAutoAssign(
  detectedCity: string,
  companyCities: string[],
  currentClientCity: string | null | undefined
): string | null {
  const canonical = normalizeCityToCanonical(detectedCity) ?? normalizeDetectedCity(detectedCity);
  if (!canonical) return null;
  if (typeof currentClientCity === 'string' && currentClientCity.trim().length > 0) return null;
  const match = companyCities.find((c) => {
    const cc = normalizeCityToCanonical(c) ?? c;
    return cc.trim().toLowerCase() === canonical.trim().toLowerCase();
  });
  return match ?? null;
}

export interface CompanyCitiesDoc {
  cities: string[];
  updatedAt?: unknown;
}

/** Получить список городов компании (один раз). */
export async function getCompanyCities(companyId: string): Promise<string[]> {
  if (!companyId) return [];
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = snap.data() as CompanyCitiesDoc | undefined;
  const list = Array.isArray(data?.cities) ? data.cities : [];
  return list.filter((c) => typeof c === 'string' && c.trim());
}

/** Подписка на список городов компании (real-time). */
export function subscribeCompanyCities(
  companyId: string,
  callback: (cities: string[]) => void
): Unsubscribe {
  if (!companyId) {
    callback([]);
    return () => {};
  }
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() as CompanyCitiesDoc | undefined;
      const list = Array.isArray(data?.cities) ? data.cities : [];
      callback(list.filter((c) => typeof c === 'string' && c.trim()));
    },
    () => callback([])
  );
}

/** Добавить город в справочник компании: нормализация, проверка дубля, сохранение. */
export async function addCompanyCity(companyId: string, cityName: string): Promise<string> {
  const normalized = normalizeCityDisplay(cityName);
  if (!normalized) throw new Error('Введите название города');
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  const cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  if (cities.some((c) => sameCity(c, normalized))) throw new Error('Такой город уже существует');
  cities.push(normalized);
  cities.sort((a, b) => a.localeCompare(b, 'ru'));
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
  return normalized;
}

/** Дополняет справочник городов компании городами из регламента (без дублей и с канонизацией алиасов). */
export async function ensureCompanyCitiesCoverage(companyId: string): Promise<void> {
  if (!companyId) return;
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  const existingRaw = Array.isArray(data.cities) ? data.cities : [];
  const normalizedSet = new Set<string>();
  for (const c of existingRaw) {
    if (typeof c !== 'string') continue;
    const canonical = normalizeCityToCanonical(c) ?? normalizeCityDisplay(c);
    if (canonical) normalizedSet.add(canonical);
  }
  for (const city of getRegulatedCitiesList()) normalizedSet.add(city);
  const merged = Array.from(normalizedSet).sort((a, b) => a.localeCompare(b, 'ru'));
  const sameLength = merged.length === existingRaw.length;
  const sameValues = sameLength && merged.every((c, i) => c === existingRaw[i]);
  if (sameValues) return;
  await setDoc(ref, { cities: merged, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Backfill: синхронизирует branchId/branchName у клиентов по текущему city согласно регламенту.
 * Возвращает количество изменённых карточек.
 */
export async function backfillClientBranchesByCityRegulation(
  companyId: string,
  branchIdByName: Partial<Record<'Астана' | 'Алматы', string>>
): Promise<number> {
  if (!companyId) return 0;
  const clientsSnap = await getDocs(
    query(collection(db, COLLECTION_CLIENTS), where('companyId', '==', companyId))
  );
  if (clientsSnap.empty) return 0;
  const updates: Array<{ id: string; branchId: string | null; branchName: string | null }> = [];
  clientsSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const cityRaw = typeof data.city === 'string' ? data.city : null;
    const currentBranchId = typeof data.branchId === 'string' ? data.branchId.trim() : '';
    const currentBranchName = typeof data.branchName === 'string' ? data.branchName.trim() : '';
    const consistent = buildConsistentCityBranch(cityRaw, [
      { id: branchIdByName.Астана ?? '', name: 'Астана' },
      { id: branchIdByName.Алматы ?? '', name: 'Алматы' }
    ]);
    const targetBranchId = consistent.branchName ? (branchIdByName[consistent.branchName] ?? null) : null;
    const targetBranchName = consistent.branchName;
    if ((currentBranchId || null) === targetBranchId && (currentBranchName || null) === targetBranchName) return;
    updates.push({ id: d.id, branchId: targetBranchId, branchName: targetBranchName });
  });
  if (updates.length === 0) return 0;
  const CHUNK = 400;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + CHUNK);
    for (const row of chunk) {
      const ref = doc(db, COLLECTION_CLIENTS, row.id);
      batch.update(ref, {
        branchId: row.branchId,
        branchName: row.branchName
      });
    }
    await batch.commit();
  }
  return updates.length;
}

/** Переименовать город в справочнике и у всех клиентов компании. */
export async function renameCompanyCity(
  companyId: string,
  oldName: string,
  newName: string
): Promise<string> {
  const oldNorm = (oldName ?? '').trim();
  const newNorm = normalizeCityDisplay(newName);
  if (!oldNorm || !newNorm) throw new Error('Укажите название');
  if (sameCity(oldNorm, newNorm)) return newNorm;
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  let cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  const idx = cities.findIndex((c) => sameCity(c, oldNorm));
  if (idx === -1) throw new Error('Город не найден');
  if (cities.some((c) => sameCity(c, newNorm))) throw new Error('Такой город уже есть');
  cities[idx] = newNorm;
  cities.sort((a, b) => a.localeCompare(b, 'ru'));
  const clientsRef = collection(db, COLLECTION_CLIENTS);
  const clientsSnap = await getDocs(
    query(
      clientsRef,
      where('companyId', '==', companyId),
      where('city', '==', oldNorm)
    )
  );
  const batch = writeBatch(db);
  clientsSnap.docs.forEach((d) => {
    const branchName = resolveBranchNameByCity(newNorm);
    batch.update(d.ref, {
      city: newNorm,
      branchId: null,
      branchName: branchName ?? null
    });
  });
  await batch.commit();
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
  return newNorm;
}

/** Удалить город из справочника и сбросить city у клиентов компании. */
export async function removeCompanyCity(companyId: string, cityName: string): Promise<void> {
  const normalized = (cityName ?? '').trim();
  if (!normalized) return;
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  let cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  const idx = cities.findIndex((c) => sameCity(c, normalized));
  if (idx === -1) return;
  cities.splice(idx, 1);
  const clientsRef = collection(db, COLLECTION_CLIENTS);
  const clientsSnap = await getDocs(
    query(
      clientsRef,
      where('companyId', '==', companyId),
      where('city', '==', normalized)
    )
  );
  const batch = writeBatch(db);
  clientsSnap.docs.forEach((d) => {
    batch.update(d.ref, { city: null, branchId: null, branchName: null });
  });
  await batch.commit();
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
}
