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
