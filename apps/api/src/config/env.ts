interface ApiEnv {
  port: number;
  corsOrigins: string[];
  nodeEnv: string;
  hasFirebaseJson: boolean;
  firebaseProjectId: string | null;
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

export function loadApiEnv(src: NodeJS.ProcessEnv = process.env): ApiEnv {
  const port = parsePort(src.PORT);
  const corsOrigins = parseCorsOrigins(src.CORS_ORIGINS);
  return {
    port,
    corsOrigins,
    nodeEnv: src.NODE_ENV ?? 'development',
    hasFirebaseJson: Boolean(src.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
    firebaseProjectId: src.FIREBASE_PROJECT_ID?.trim() || null,
  };
}

