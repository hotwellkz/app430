interface ApiEnv {
  port: number;
  corsOrigins: string[];
  nodeEnv: 'development' | 'test' | 'production';
  hasFirebaseJson: boolean;
  firebaseProjectId: string | null;
  googleApplicationCredentials: string | null;
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
  const nodeEnv = parseNodeEnv(src.NODE_ENV);
  assertProdCorsSafety(nodeEnv, corsOrigins);
  return {
    port,
    corsOrigins,
    nodeEnv,
    hasFirebaseJson: Boolean(src.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
    firebaseProjectId: src.FIREBASE_PROJECT_ID?.trim() || null,
    googleApplicationCredentials: src.GOOGLE_APPLICATION_CREDENTIALS?.trim() || null,
  };
}

