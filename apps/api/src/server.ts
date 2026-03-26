import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRequestContext } from './plugins/requestContext.js';
import { registerProjectRoutes } from './routes/projectsRoutes.js';

const PORT = Number(process.env.PORT) || 3001;
const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map((s) => s.trim()).filter(Boolean);

async function main() {
  const app = Fastify({ logger: true });

  registerRequestContext(app);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-sip-user-id', 'x-request-id'],
  });

  app.get('/health', async () => ({ ok: true, service: 'sip-editor-api' }));

  await registerProjectRoutes(app);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
