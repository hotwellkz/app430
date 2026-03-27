import { FieldValue } from 'firebase-admin/firestore';

/**
 * Firestore rejects `undefined` at any depth. Recursively drop undefined keys.
 * Preserves Firestore sentinels (FieldValue) and `null`.
 */
export function omitUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof FieldValue) {
    return value;
  }
  if (Array.isArray(value)) {
    const mapped = value
      .filter((item) => item !== undefined)
      .map((item) => omitUndefinedDeep(item));
    return mapped as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = omitUndefinedDeep(v);
  }
  return out as T;
}
