import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadApiEnv } from './config/env.js';
import { registerRequestContext } from './plugins/requestContext.js';
import { registerProjectRoutes } from './routes/projectsRoutes.js';
import { buildHealthDetails } from './services/healthService.js';

const env = loadApiEnv();
const PORT = env.port;
const allowedOrigins = env.corsOrigins;

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

  app.get('/health', async (request, reply) => {
    const details = await buildHealthDetails(request, {
      nodeEnv: env.nodeEnv,
      hasFirebaseJson: env.hasFirebaseJson,
      firebaseProjectId: env.firebaseProjectId,
    });
    const status = details.ok ? 200 : 503;
    return reply.code(status).send({
      ok: details.ok,
      service: details.service,
      timestamp: details.timestamp,
      requestId: details.requestId,
      checks: details.checks,
    });
  });

  app.get('/health/details', async (request, reply) => {
    const details = await buildHealthDetails(request, {
      nodeEnv: env.nodeEnv,
      hasFirebaseJson: env.hasFirebaseJson,
      firebaseProjectId: env.firebaseProjectId,
    });
    const status = details.ok ? 200 : 503;
    if (env.nodeEnv === 'production') {
      return reply.code(status).send({
        ok: details.ok,
        service: details.service,
        timestamp: details.timestamp,
        requestId: details.requestId,
        checks: details.checks,
      });
    }
    return reply.code(status).send(details);
  });

  await registerProjectRoutes(app);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
