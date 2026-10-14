import { NotFoundError } from '@spamtools/card-catalog';
import { DomainError } from '@spamtools/shared-kernel';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { assetRoutes } from './assetRoutes.js';
import { catalogRoutes } from './catalogRoutes.js';

export function createServer(container: Container, { logger = true }: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger });

  // Erreurs métier -> codes HTTP ; le reste est une erreur interne, journalisée mais non détaillée.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: error.message });
    }
    if (error instanceof DomainError || error.validation !== undefined) {
      return reply.code(400).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Erreur interne' });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.register(catalogRoutes, { container });
  app.register(assetRoutes, { assetsDirectory: container.config.assetsDirectory });

  return app;
}
