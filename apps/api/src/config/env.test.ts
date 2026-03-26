import { describe, expect, it } from 'vitest';
import { loadApiEnv } from './env.js';

describe('loadApiEnv', () => {
  it('возвращает дефолты', () => {
    const env = loadApiEnv({});
    expect(env.port).toBe(3001);
    expect(env.corsOrigins.length).toBeGreaterThan(0);
  });

  it('валидирует порт', () => {
    expect(() => loadApiEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadApiEnv({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('валидирует CORS_ORIGINS', () => {
    expect(() => loadApiEnv({ CORS_ORIGINS: '   ' })).toThrow(/CORS_ORIGINS/);
  });
});

