import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { DomainError, ForbiddenError, NotFoundError, UnauthenticatedError } from '@spamtools/shared-kernel';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { assetRoutes } from './assetRoutes.js';
import { registerAuthentication } from './authentication.js';
import { authRoutes } from './authRoutes.js';
import { catalogRoutes } from './catalogRoutes.js';
import { collectionRoutes } from './collectionRoutes.js';
import { deckRoutes } from './deckRoutes.js';
import { webRoutes } from './webRoutes.js';

export function createServer(container: Container, { logger = true }: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger, trustProxy: container.config.trustProxy ?? false });

  // Erreurs métier -> codes HTTP ; le reste est une erreur interne, journalisée mais non détaillée.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof UnauthenticatedError) {
      return reply.code(401).send({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return reply.code(403).send({ error: error.message });
    }
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: error.message });
    }
    if (error instanceof DomainError || error.validation !== undefined) {
      return reply.code(400).send({ error: error.message });
    }
    // Erreurs HTTP des plugins (trop de tentatives : 429…) : leur code, leur message.
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Erreur interne' });
  });

  app.register(cookie);
  // Limite appliquée route par route (connexion, liens et changement de mot de passe).
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      message: `Trop de tentatives : réessayez dans ${Math.ceil(context.ttl / 1000)} s`,
    }),
  });
  app.after(() => registerAuthentication(app, container));
  app.get('/api/health', async () => ({ status: 'ok' }));
  app.register(authRoutes, { container });
  app.register(catalogRoutes, { container });
  app.register(deckRoutes, { container });
  app.register(collectionRoutes, { container });
  if (container.config.webDirectory !== undefined) {
    app.register(webRoutes, { webDirectory: container.config.webDirectory, container });
  }
  app.register(assetRoutes, { assetsDirectory: container.config.assetsDirectory });

  return app;
}
