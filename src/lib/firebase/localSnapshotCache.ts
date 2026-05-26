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
