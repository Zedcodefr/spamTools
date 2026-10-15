import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { accountOf } from './authentication.js';

const slotsSchema = {
  type: 'array',
  maxItems: 4,
  items: {
    type: 'object',
    required: ['cardId', 'talentSlot'],
    properties: { cardId: { type: 'string', minLength: 1 }, talentSlot: { type: ['integer', 'null'], minimum: 1 } },
  },
} as const;

const deckBody = {
  type: 'object',
  required: ['name', 'version', 'slots'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    slots: slotsSchema,
    dpsCardId: { type: ['string', 'null'] },
  },
} as const;

interface DeckBody {
  name: string;
  version: string;
  slots: { cardId: string; talentSlot: number | null }[];
  dpsCardId?: string | null;
}

interface SuggestionBody {
  version: string;
  slots: { cardId: string; talentSlot: number | null }[];
  damage: 'total' | 'single';
  healWeight: number;
  turns?: number;
  excludedCardIds?: string[];
  count?: number;
}

interface AnalysisBody {
  version: string;
  slots: { cardId: string; talentSlot: number | null }[];
  turns?: number;
  dpsCardId?: string | null;
}

/**
 * Adaptateur entrant : decks (création, consultation, modification, suppression) et analyse.
 */
export async function deckRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  const { language } = container.config;

  app.get('/api/decks', (request) => container.listDecks.execute({ ownerId: accountOf(request).id }));

  app.post<{ Body: DeckBody }>('/api/decks', { schema: { body: deckBody } }, async (request, reply) =>
    reply.code(201).send(await container.saveDeck.execute({ ...request.body, language, ownerId: accountOf(request).id })),
  );

  app.get<{ Params: { id: string } }>('/api/decks/:id', (request) =>
    container.getDeck.execute({ id: request.params.id, ownerId: accountOf(request).id }),
  );

  app.put<{ Params: { id: string }; Body: DeckBody }>('/api/decks/:id', { schema: { body: deckBody } }, (request) =>
    container.saveDeck.execute({ ...request.body, id: request.params.id, language, ownerId: accountOf(request).id }),
  );

  app.delete<{ Params: { id: string } }>('/api/decks/:id', async (request, reply) => {
    await container.deleteDeck.execute({ id: request.params.id, ownerId: accountOf(request).id });
    return reply.code(204).send();
  });

  // Autocomplétion : complète les cartes données pour maximiser dégâts, soins ou un compromis.
  app.post<{ Body: SuggestionBody }>(
    '/api/decks/suggestions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['version', 'slots', 'damage', 'healWeight'],
          properties: {
            version: { type: 'string' },
            slots: slotsSchema,
            damage: { enum: ['total', 'single'] },
            healWeight: { type: 'number', minimum: 0, maximum: 1 },
            turns: { type: 'integer', minimum: 1, maximum: 50 },
            excludedCardIds: { type: 'array', items: { type: 'string' } },
            count: { type: 'integer', minimum: 1, maximum: 10 },
          },
        },
      },
    },
    (request) => container.suggestDecks.execute({ ...request.body, turns: request.body.turns ?? 10, language }),
  );

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
            dpsCardId: { type: ['string', 'null'] },
          },
        },
      },
    },
    (request) => container.analyzeDeck.execute({ ...request.body, language }),
  );
}
