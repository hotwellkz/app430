interface ApiEnv {
  port: number;
  corsOrigins: string[];
  /** Если задан (напр. papaya-seahorse-f4694d), разрешить preview/branch deploy на Netlify для этого сайта. */
  corsNetlifySiteSlug: string | null;
  nodeEnv: 'development' | 'test' | 'production';
  hasFirebaseJson: boolean;
  firebaseProjectId: string | null;
  googleApplicationCredentials: string | null;
  storageBucket: string | null;
  importExtractorMode: 'mock';
  importJobExecutionMode: 'sync' | 'async-inline';
}

function parsePort(raw: string | undefined): number {
  if (!raw || !raw.trim()) return 3001;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`PORT должен быть целым числом 1..65535, получено: ${raw}`);
  }
  return parsed;
}

function parseCorsOrigins(raw: string | undefined): string[] {
  const value = raw ?? 'http://localhost:5174,http://localhost:5173';
  const list = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error('CORS_ORIGINS не должен быть пустым');
  }
  return list;
}

function parseNodeEnv(raw: string | undefined): ApiEnv['nodeEnv'] {
  if (!raw || !raw.trim()) return 'development';
  if (raw === 'development' || raw === 'test' || raw === 'production') return raw;
  throw new Error(`NODE_ENV должен быть development|test|production, получено: ${raw}`);
}

function parseImportExtractorMode(raw: string | undefined): ApiEnv['importExtractorMode'] {
  if (!raw || !raw.trim()) return 'mock';
  return 'mock';
}

function parseImportJobExecutionMode(
  raw: string | undefined
): ApiEnv['importJobExecutionMode'] {
  if (!raw || !raw.trim()) return 'sync';
  if (raw === 'sync' || raw === 'async-inline') return raw;
  throw new Error(
    `IMPORT_JOB_EXECUTION_MODE должен быть sync|async-inline, получено: ${raw}`
  );
}

function assertProdCorsSafety(nodeEnv: ApiEnv['nodeEnv'], corsOrigins: string[]): void {
  if (nodeEnv !== 'production') return;
  const hasLocalhost = corsOrigins.some((origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  );
  if (hasLocalhost) {
    throw new Error(
      'CORS_ORIGINS для production не должен содержать localhost/127.0.0.1'
    );
  }
}

export function loadApiEnv(src: NodeJS.ProcessEnv = process.env): ApiEnv {
  const port = parsePort(src.PORT);
  const corsOrigins = parseCorsOrigins(src.CORS_ORIGINS);
  const corsNetlifySiteSlug = src.CORS_NETLIFY_SITE_SLUG?.trim() || null;
  const nodeEnv = parseNodeEnv(src.NODE_ENV);
  assertProdCorsSafety(nodeEnv, corsOrigins);
  return {
    port,
    corsOrigins,
    corsNetlifySiteSlug,
    nodeEnv,
    hasFirebaseJson: Boolean(src.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
    firebaseProjectId: src.FIREBASE_PROJECT_ID?.trim() || null,
    googleApplicationCredentials: src.GOOGLE_APPLICATION_CREDENTIALS?.trim() || null,
    storageBucket: src.FIREBASE_STORAGE_BUCKET?.trim() || null,
    importExtractorMode: parseImportExtractorMode(src.IMPORT_EXTRACTOR_MODE),
    importJobExecutionMode: parseImportJobExecutionMode(src.IMPORT_JOB_EXECUTION_MODE),
  };
}

