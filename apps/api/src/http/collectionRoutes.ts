import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';

interface OwnedBody {
  cardIds: string[];
  owned: boolean;
}

/**
 * Adaptateur entrant : la collection du joueur (cartes possédées).
 */
export async function collectionRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  app.get('/api/collection', () => container.getCollection.execute());

  // Ajoute (owned: true) ou retire des cartes ; une seule ou plusieurs (tout sélectionner).
  app.put<{ Body: OwnedBody }>(
    '/api/collection/cards',
    {
      schema: {
        body: {
          type: 'object',
          required: ['cardIds', 'owned'],
          properties: {
            cardIds: { type: 'array', maxItems: 1000, items: { type: 'string', minLength: 1 } },
            owned: { type: 'boolean' },
          },
        },
      },
    },
    (request) => container.setCardsOwned.execute(request.body),
  );
}
