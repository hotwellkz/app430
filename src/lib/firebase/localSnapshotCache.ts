/**
 * Лёгкая утилита: сохраняем результаты onSnapshot в localStorage,
 * чтобы при следующем монтировании компонента UI рендерился МГНОВЕННО
 * (из локального кеша), а свежие данные подтягивались с Firestore в фоне.
 *
 * Это поверх Firestore IndexedDB persistence (`persistentLocalCache`):
 *   - persistentLocalCache ускоряет СЕТЬ (нет запроса на сервер).
 *   - Этот модуль ускоряет РЕНДЕР (React-стейт восстанавливается из cache,
 *     без обхода 1700+ документов и пересоздания Map'ов в первый кадр).
 *
 * Поведение «как в WhatsApp Web»:
 *   1) Открыл страницу → instant из localStorage (старая, но валидная картинка).
 *   2) В фоне Firestore присылает свежий snapshot → state обновляется.
 *
 * Сериализация: JSON. Для Map используем хелпер `Map → Array<[key, value]>`.
 * Ключи именуем явно с префиксом версии — при изменении схемы старые кеши
 * автоматически невалидны.
 */

const PREFIX = 'fs-cache:';
const VERSION = 'v1';

function fullKey(key: string): string {
  return `${PREFIX}${VERSION}:${key}`;
}

export function readSnapshotCache<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(fullKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSnapshotCache<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch (err) {
    // QuotaExceededError или приватный режим — молча.
    if (import.meta.env?.DEV) {
      console.warn('[fs-cache] write failed for', key, err);
    }
  }
}

export function clearSnapshotCache(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(fullKey(key));
  } catch {
    // ignore
  }
}

/** Map → [[k,v], ...] чтобы JSON-сериализовалось. */
export function readSnapshotCacheMap<V>(key: string): Map<string, V> | null {
  const arr = readSnapshotCache<Array<[string, V]>>(key);
  if (!arr || !Array.isArray(arr)) return null;
  try {
    return new Map(arr);
  } catch {
    return null;
  }
}

export function writeSnapshotCacheMap<V>(
  key: string,
  value: Map<string, V>,
): void {
  writeSnapshotCache(key, Array.from(value.entries()));
}

/**
 * Очистить весь fs-cache. Можно вызывать, например, при выходе пользователя
 * или при ошибке расшифровки/валидации.
 */
export function clearAllSnapshotCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const prefix = `${PREFIX}${VERSION}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/* ───────────── Rich (Date/Timestamp-aware) ───────────── */

const DATE_MARKER = '__cacheDate';

interface DateLikeMarker {
  [DATE_MARKER]: string;
}

function isFirestoreTimestamp(v: unknown): v is { seconds: number; nanoseconds: number; toMillis?: () => number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as { seconds?: unknown; nanoseconds?: unknown };
  return typeof o.seconds === 'number' && typeof o.nanoseconds === 'number';
}

/** Заменяет Date/Timestamp на маркер для JSON-сериализации. */
function serializeRich(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    return { [DATE_MARKER]: value.toISOString() } as DateLikeMarker;
  }
  if (isFirestoreTimestamp(value)) {
    const t = typeof value.toMillis === 'function'
      ? value.toMillis()
      : value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
    return { [DATE_MARKER]: new Date(t).toISOString() } as DateLikeMarker;
  }
  if (Array.isArray(value)) return value.map(serializeRich);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeRich(v);
    }
    return out;
  }
  return value;
}

/** Восстанавливает Date из маркеров. Timestamp восстановить нельзя — даём Date. */
function reviveRich(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o[DATE_MARKER] === 'string') {
      return new Date(o[DATE_MARKER] as string);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = reviveRich(v);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(reviveRich);
  return value;
}

/**
 * Запись/чтение с поддержкой Date и Firestore Timestamp. Timestamp при
 * чтении вернётся как Date (так и нужно — UI обычно вызывает .getTime() или
 * пользуется хелперами типа dateLike).
 */
export function writeSnapshotCacheRich<T>(key: string, value: T): void {
  writeSnapshotCache(key, serializeRich(value));
}

export function readSnapshotCacheRich<T>(key: string): T | null {
  const raw = readSnapshotCache<unknown>(key);
  if (raw === null) return null;
  try {
    return reviveRich(raw) as T;
  } catch {
    return null;
  }
}
