#!/usr/bin/env node
/**
 * Создаёт локальные env-файлы для SIP-стека, если их ещё нет (не перезаписывает).
 * Запуск: pnpm sip:scaffold-env
 */
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  {
    path: resolve(root, '.env.development.local'),
    content: `# Локальный SIP-стек (CRM + API + редактор). Не коммитится.
# Подробнее: docs/local-dev-sip-editor.md

VITE_SIP_API_BASE_URL=/sip-editor-api
VITE_SIP_EDITOR_ORIGIN=http://localhost:5174
`,
  },
  {
    path: resolve(root, 'apps/sip-editor-web/.env.development.local'),
    content: `# Локальный редактор рядом с CRM на :5173. Не коммитится.

VITE_CRM_ORIGIN=http://localhost:5173
`,
  },
  {
    path: resolve(root, 'apps/api/.env'),
    content: `# Локальный Fastify API. Не коммитится.
# Firestore: один раз — pnpm sip:adc (browser), либо ключ в FIREBASE_SERVICE_ACCOUNT_JSON

PORT=3001
CORS_ORIGINS=http://localhost:5174,http://localhost:5173
NODE_ENV=development

FIREBASE_PROJECT_ID=hotwell-crm
FIREBASE_STORAGE_BUCKET=hotwell-crm-sip-imports
GOOGLE_APPLICATION_CREDENTIALS=

# FIREBASE_SERVICE_ACCOUNT_JSON=
`,
  },
];

let created = 0;
for (const { path, content } of files) {
  if (existsSync(path)) {
    console.log(`skip (exists): ${path}`);
    continue;
  }
  writeFileSync(path, content, 'utf8');
  console.log(`created: ${path}`);
  created += 1;
}
console.log(created ? `Done: ${created} file(s) created.` : 'Done: nothing to create.');
