import { describe, expect, it } from 'vitest';
import { loadApiEnv } from './env.js';

describe('loadApiEnv', () => {
  it('возвращает дефолты', () => {
    const env = loadApiEnv({});
    expect(env.port).toBe(3001);
    expect(env.nodeEnv).toBe('development');
    expect(env.corsOrigins.length).toBeGreaterThan(0);
    expect(env.storageBucket).toBeNull();
  });

  it('валидирует порт', () => {
    expect(() => loadApiEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadApiEnv({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('валидирует CORS_ORIGINS', () => {
    expect(() => loadApiEnv({ CORS_ORIGINS: '   ' })).toThrow(/CORS_ORIGINS/);
  });

  it('валидирует NODE_ENV', () => {
    expect(() => loadApiEnv({ NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });

  it('запрещает localhost в CORS_ORIGINS для production', () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'http://localhost:5173,https://2wix.ru',
      })
    ).toThrow(/CORS_ORIGINS/);
  });
});

