#!/usr/bin/env node
/**
 * Быстрая справка по локальному SIP-стеку (без доступа к сети).
 * Не читает секреты; только напоминает порты и типичные env.
 */

const lines = [
  '=== SIP local dev (ожидаемые порты) ===',
  '  @2wix/api (Fastify)     http://127.0.0.1:3001   (health: GET /health)',
  '  CRM (Vite)             http://localhost:5173',
  '  sip-editor-web (Vite)  http://localhost:5174',
  '',
  '=== Типичные env (CRM, корень репозитория) ===',
  '  VITE_SIP_API_BASE_URL=/sip-editor-api   → CRM проксирует на :3001 (vite.config.ts)',
  '  VITE_SIP_EDITOR_ORIGIN                  → не задавайте в DEV на localhost,',
  '                                           тогда «Открыть» ведёт на http://localhost:5174',
  '  (override: .env.development.local имеет приоритет над .env)',
  '',
  '=== sip-editor-web ===',
  '  VITE_API_BASE_URL=   (пусто) → запросы на /api/*, прокси на :3001',
  '  VITE_CRM_ORIGIN=http://localhost:5173 — опционально для ссылок «в CRM»',
  '',
  '=== Команды ===',
  '  pnpm dev:sip-local     — API + CRM + редактор параллельно',
  '  pnpm dev:api | dev:crm | dev:sip-editor — по отдельности',
  '',
  '=== Как заметить, что ушли в production ===',
  '  В Network запросы к api идут на api.2wix.ru / *.run.app, не на :3001 или /sip-editor-api.',
  '  «Открыть» открывает не localhost:5174 — проверьте VITE_SIP_EDITOR_ORIGIN в .env.',
];

console.log(lines.join('\n'));
