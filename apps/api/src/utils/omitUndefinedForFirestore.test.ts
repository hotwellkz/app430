import { FieldValue } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { omitUndefinedDeep } from './omitUndefinedForFirestore.js';

describe('omitUndefinedDeep', () => {
  it('удаляет undefined на любом уровне вложенности', () => {
    const input = {
      a: 1,
      b: undefined,
      nested: { c: 'x', d: undefined, inner: { e: undefined, f: 2 } },
    };
    expect(omitUndefinedDeep(input)).toEqual({
      a: 1,
      nested: { c: 'x', inner: { f: 2 } },
    });
  });

  it('сохраняет null и FieldValue', () => {
    const ts = FieldValue.serverTimestamp();
    expect(
      omitUndefinedDeep({
        x: null,
        y: undefined,
        z: ts,
      })
    ).toEqual({ x: null, z: ts });
  });

  it('фильтрует undefined из массивов', () => {
    expect(omitUndefinedDeep([1, undefined, 2])).toEqual([1, 2]);
  });
});
