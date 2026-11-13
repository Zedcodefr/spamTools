import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { adminOf } from './authentication.js';

const versionQuery = {
  type: 'object',
  properties: { version: { type: 'string' } },
} as const;

interface VersionQuery {
  version?: string;
}

interface CardsQuery extends VersionQuery {
  element?: string;
  rarity?: string;
  q?: string;
}

/**
 * Adaptateur entrant : consultation du catalogue des cartes.
 * Sans `version`, c'est la version la plus récente importée qui est servie.
 * Les chemins d'images renvoyés sont relatifs à /api/assets/.
 */
export async function catalogRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  const { language } = container.config;

  app.get<{ Querystring: VersionQuery }>('/api/catalog', { schema: { querystring: versionQuery } }, (request) =>
    container.getCatalogOverview.execute({ language, version: request.query.version }),
  );

  app.get<{ Querystring: CardsQuery }>(
    '/api/cards',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            element: { type: 'string' },
            rarity: { type: 'string' },
            q: { type: 'string' },
          },
        },
      },
    },
    (request) => {
      const { version, element, rarity, q } = request.query;
      return container.listCards.execute({ language, version, element, rarity, text: q });
    },
  );

  app.get<{ Params: { id: string }; Querystring: VersionQuery }>(
    '/api/cards/:id',
    { schema: { querystring: versionQuery } },
    (request) => container.getCard.execute({ language, id: request.params.id, version: request.query.version }),
  );

  app.get('/api/card-layout', () => container.getCardLayout.execute());

  // Mise à jour depuis spamgame.com (dernière version publiée), réservée aux administrateurs.
  app.get('/api/admin/catalog/sync', (request) => {
    adminOf(request);
    return container.catalogSyncJob.current();
  });
  app.post('/api/admin/catalog/sync', async (request, reply) => {
    const admin = adminOf(request);
    return reply.code(202).send(container.catalogSyncJob.start(admin.username));
  });
}
