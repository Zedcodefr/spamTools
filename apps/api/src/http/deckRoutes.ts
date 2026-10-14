import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';

const slotsSchema = {
  type: 'array',
  maxItems: 4,
  items: {
    type: 'object',
    required: ['cardId', 'talentSlot'],
    properties: { cardId: { type: 'string', minLength: 1 }, talentSlot: { type: 'integer', minimum: 1 } },
  },
} as const;

const deckBody = {
  type: 'object',
  required: ['name', 'version', 'slots'],
  properties: { name: { type: 'string' }, version: { type: 'string' }, slots: slotsSchema },
} as const;

interface DeckBody {
  name: string;
  version: string;
  slots: { cardId: string; talentSlot: number }[];
}

interface AnalysisBody {
  version: string;
  slots: { cardId: string; talentSlot: number }[];
  turns?: number;
}

/**
 * Adaptateur entrant : decks (création, consultation, modification, suppression) et analyse.
 */
export async function deckRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  const { language } = container.config;

  app.get('/api/decks', () => container.listDecks.execute());

  app.post<{ Body: DeckBody }>('/api/decks', { schema: { body: deckBody } }, async (request, reply) =>
    reply.code(201).send(await container.saveDeck.execute({ ...request.body, language })),
  );

  app.get<{ Params: { id: string } }>('/api/decks/:id', (request) => container.getDeck.execute({ id: request.params.id }));

  app.put<{ Params: { id: string }; Body: DeckBody }>('/api/decks/:id', { schema: { body: deckBody } }, (request) =>
    container.saveDeck.execute({ ...request.body, id: request.params.id, language }),
  );

  app.delete<{ Params: { id: string } }>('/api/decks/:id', async (request, reply) => {
    await container.deleteDeck.execute({ id: request.params.id });
    return reply.code(204).send();
  });

  // Analyse d'une composition, enregistrée ou non (POST : la composition est dans le corps).
  app.post<{ Body: AnalysisBody }>(
    '/api/decks/analysis',
    {
      schema: {
        body: {
          type: 'object',
          required: ['version', 'slots'],
          properties: {
            version: { type: 'string' },
            slots: slotsSchema,
            turns: { type: 'integer', minimum: 1, maximum: 50 },
          },
        },
      },
    },
    (request) => container.analyzeDeck.execute({ ...request.body, language }),
  );
}
