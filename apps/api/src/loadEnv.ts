/**
 * Загрузка apps/api/.env независимо от process.cwd (pnpm/concurrently/monorepo root).
 * Должен импортироваться первым в server.ts.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(dir, '../.env') });
