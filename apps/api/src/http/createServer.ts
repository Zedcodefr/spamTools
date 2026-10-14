import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';

export function createServer(container: Container): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
