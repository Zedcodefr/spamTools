import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CatalogVersion } from '../../domain/index.js';
import { cardsDocument, indexDocument } from '../../test-support/spamGameFixtures.js';
import { SpamGameCatalogSource } from './SpamGameCatalogSource.js';

function fakeFetch(files: Record<string, unknown>, requested: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    const body = files[url];
    return body === undefined ? new Response('', { status: 404 }) : new Response(JSON.stringify(body));
  }) as typeof fetch;
}

const BASE = 'https://example.test/data/';

describe('SpamGameCatalogSource', () => {
  it("résout le document de cartes à partir du modèle de l'index", async () => {
    const requested: string[] = [];
    const source = new SpamGameCatalogSource(
      BASE,
      fakeFetch({ [`${BASE}index.json`]: indexDocument(), [`${BASE}1.21/cards.fr.json`]: cardsDocument() }, requested),
    );

    const { catalog, rawDocument } = await source.fetchCatalog(CatalogVersion.of('1.21'), 'fr');

    assert.equal(catalog.cards.length, 2);
    assert.equal(JSON.parse(rawDocument).version, '1.21');
    assert.deepEqual(requested, [`${BASE}index.json`, `${BASE}1.21/cards.fr.json`]);
  });

  it('remonte les erreurs HTTP', async () => {
    const source = new SpamGameCatalogSource(BASE, fakeFetch({}));
    await assert.rejects(source.fetchIndex(), /HTTP 404/);
  });

  it('refuse un chemin qui sort du dossier de données', async () => {
    const source = new SpamGameCatalogSource(
      BASE,
      fakeFetch({ [`${BASE}index.json`]: indexDocument({ cards: '../../{version}/cards.{language}.json' }) }),
    );
    await assert.rejects(source.fetchCatalog(CatalogVersion.of('1.21'), 'fr'), /hors du dossier de données/);
  });
});
