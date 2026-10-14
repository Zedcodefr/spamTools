import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { importRoutes } from './importRoutes.js';

export function createServer(container: Container): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.register(importRoutes, { container });

  return app;
}
