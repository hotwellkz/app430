/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { apiErrorBodyFromResponse } from './http';

describe('apiErrorBodyFromResponse', () => {
  it('не падает при пустом теле и JSON null (регрессия: null.code)', () => {
    const r = new Response('', { status: 500, statusText: 'Internal Server Error' });
    const a = apiErrorBodyFromResponse(null, r);
    expect(a.code).toBe('INTERNAL_ERROR');
    expect(a.message).toBe('Internal Server Error');
    expect(a.status).toBe(500);
  });

  it('подхватывает поля из JSON-объекта', () => {
    const r = new Response('', { status: 400 });
    const a = apiErrorBodyFromResponse(
      { code: 'VALIDATION_ERROR', message: 'bad', status: 400 },
      r
    );
    expect(a.code).toBe('VALIDATION_ERROR');
    expect(a.message).toBe('bad');
  });
});
