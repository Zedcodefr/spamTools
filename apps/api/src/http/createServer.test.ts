import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createContainer, type Container } from '../container.js';
import { fakeSpamGameSource } from '../test-support/fakeSpamGameSource.js';
import { createServer } from './createServer.js';

const FIRE_SPIRIT = '18bca5cf-7aa1-421c-85ec-4ed0b6a8ca70';

describe('API catalogue', () => {
  let directory: string;
  let container: Container;
  let app: FastifyInstance;

  before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'spamtools-api-'));
    container = await createContainer(
      { databasePath: ':memory:', language: 'fr', assetsDirectory: path.join(directory, 'assets') },
      { catalogSource: fakeSpamGameSource() },
    );
    await container.syncCatalog.execute({ language: 'fr', version: '1.9' });
    await container.syncCatalog.execute({ language: 'fr' });
    app = createServer(container, { logger: false });
  });

  after(async () => {
    await app.close();
    await container.close();
    await rm(directory, { recursive: true, force: true });
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('GET /api/catalog décrit la dernière version et les versions disponibles', async () => {
    const response = await get('/api/catalog');
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.version, '1.10');
    assert.deepEqual(body.availableVersions, ['1.10', '1.9']);
    assert.deepEqual(body.elements.map((element: { id: string }) => element.id), ['fire', 'water']);
    assert.ok(body.specialAbilities.length > 0);
    assert.ok(body.traitCategories.length > 0);
  });

  it('GET /api/cards liste et filtre les cartes', async () => {
    assert.equal((await get('/api/cards')).json().cards.length, 2);
    assert.deepEqual(
      (await get('/api/cards?element=water')).json().cards.map((card: { name: string }) => card.name),
      ['Hibernatus'],
    );
    assert.equal((await get('/api/cards?q=souffle')).json().cards.length, 1);
    assert.equal((await get('/api/cards?version=1.9')).json().cards[0].hp, 400);
  });

  it('GET /api/cards/:id renvoie une carte ou 404', async () => {
    const found = await get(`/api/cards/${FIRE_SPIRIT}`);
    assert.equal(found.statusCode, 200);
    assert.equal(found.json().card.artwork.artist.name, 'Atto');
    assert.deepEqual(found.json().card.traits.strikeElements, ['fire']);
    assert.equal((await get('/api/cards/inconnue')).statusCode, 404);
  });

  it('répond 400 à une version mal formée et 404 à une version non importée', async () => {
    assert.equal((await get('/api/cards?version=abc')).statusCode, 400);
    assert.equal((await get('/api/cards?version=2.0')).statusCode, 404);
  });

  it('GET /api/card-layout renvoie le plan de carte', async () => {
    assert.equal((await get('/api/card-layout')).json().width, 961);
  });

  it('GET /api/assets/* sert les images téléchargées', async () => {
    const response = await get('/api/assets/img/elements/fire.webp');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/webp');
    assert.equal(response.body, 'image:img/elements/fire.webp');
  });

  describe('decks', () => {
    const send = (method: 'POST' | 'PUT', url: string, payload: Record<string, unknown>) =>
      app.inject({ method, url, payload });

    it('crée, modifie, liste et supprime un deck', async () => {
      const created = await send('POST', '/api/decks', {
        name: 'Test',
        version: '1.10',
        slots: [{ cardId: FIRE_SPIRIT, talentSlot: 1 }],
        dpsCardId: FIRE_SPIRIT,
      });
      assert.equal(created.statusCode, 201);
      assert.equal(created.json().dpsCardId, FIRE_SPIRIT);
      assert.equal((await get(`/api/decks/${created.json().id}`)).json().dpsCardId, FIRE_SPIRIT);
      const { id } = created.json();

      const updated = await send('PUT', `/api/decks/${id}`, {
        name: 'Test 2',
        version: '1.10',
        slots: [],
      });
      assert.equal(updated.statusCode, 200);
      assert.deepEqual(updated.json().slots, []);
      assert.deepEqual((await get('/api/decks')).json().map((deck: { name: string }) => deck.name), ['Test 2']);

      assert.equal((await app.inject({ method: 'DELETE', url: `/api/decks/${id}` })).statusCode, 204);
      assert.equal((await get(`/api/decks/${id}`)).statusCode, 404);
    });

    it('refuse un doublon (400), plus de 4 cartes (400) ou une carte inconnue (404)', async () => {
      const deck = (slots: unknown[]) => send('POST', '/api/decks', { name: 'X', version: '1.10', slots });
      const fire = { cardId: FIRE_SPIRIT, talentSlot: 1 };
      assert.equal((await deck([fire, fire])).statusCode, 400);
      assert.equal((await deck([fire, fire, fire, fire, fire])).statusCode, 400);
      assert.equal((await deck([{ cardId: 'inconnue', talentSlot: 1 }])).statusCode, 404);
      assert.equal((await deck([{ cardId: FIRE_SPIRIT, talentSlot: 9 }])).statusCode, 404);
    });

    it('accepte une carte sans talent', async () => {
      const created = await send('POST', '/api/decks', {
        name: 'Sans talent',
        version: '1.10',
        slots: [{ cardId: FIRE_SPIRIT, talentSlot: null }],
      });
      assert.equal(created.statusCode, 201);
      assert.equal((await get(`/api/decks/${created.json().id}`)).json().slots[0].talentSlot, null);
      const analysis = await send('POST', '/api/decks/analysis', {
        version: '1.10',
        slots: [{ cardId: FIRE_SPIRIT, talentSlot: null }],
      });
      assert.equal(analysis.json().cards[0].talentName, null);
    });

    it('analyse une composition avec la projection des bonus', async () => {
      const response = await send('POST', '/api/decks/analysis', {
        version: '1.10',
        slots: [{ cardId: FIRE_SPIRIT, talentSlot: 1 }],
        turns: 3,
        dpsCardId: FIRE_SPIRIT,
      });
      assert.equal(response.statusCode, 200);
      const analysis = response.json();
      assert.ok(analysis.damagePerTurn.fire > 0);
      assert.equal(analysis.turns.length, 3);
      assert.equal(analysis.dpsCardId, FIRE_SPIRIT);
      assert.ok(analysis.averageResistances.fire !== undefined);
    });
  });

  for (const url of [
    '/api/assets/img/elements/absent.webp',
    '/api/assets/../../package.json',
    '/api/assets/img/..%2F..%2F..%2Fpackage.json',
    '/api/assets/%2E%2E/%2E%2E/package.json',
    '/api/assets/img/elements',
  ]) {
    it(`GET ${url} répond 404`, async () => {
      assert.equal((await get(url)).statusCode, 404);
    });
  }
});
