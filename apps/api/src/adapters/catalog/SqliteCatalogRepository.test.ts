import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { CatalogVersion, SyncCatalog, type AssetStore } from '@spamtools/card-catalog';
import { SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { cardDocument, cardsDocument, indexDocument, layoutDocument } from '@spamtools/card-catalog/testing';
import { MigrateDatabase } from '@spamtools/database';
import { SqlMigrationSource, SqliteDatabase, SqliteMigrationJournal } from '@spamtools/database/infrastructure';
import { migrations } from '../../migrations.js';
import { SqliteCatalogRepository } from './SqliteCatalogRepository.js';

const BASE = 'https://example.test/data/';

/** Source spamgame.com simulée : versions 1.9 et 1.10 (pour vérifier l'ordre numérique). */
function fakeSource(): SpamGameCatalogSource {
  const files: Record<string, unknown> = {
    'index.json': indexDocument({ latest: '1.10', versions: [{ version: '1.9' }, { version: '1.10' }] }),
    'layout.json': layoutDocument(),
    '1.9/cards.fr.json': cardsDocument({ version: '1.9', cards: [cardDocument({ hp: 400 })] }),
    '1.10/cards.fr.json': cardsDocument({ version: '1.10' }),
  };
  const fetchImpl = (async (input: string | URL | Request) => {
    const body = files[String(input).slice(BASE.length)];
    return body === undefined ? new Response('', { status: 404 }) : new Response(JSON.stringify(body));
  }) as typeof fetch;
  return new SpamGameCatalogSource(BASE, fetchImpl);
}

const noAssets: AssetStore = { has: async () => true, put: async () => undefined };

describe('SqliteCatalogRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteCatalogRepository;

  beforeEach(async () => {
    database = new SqliteDatabase(':memory:');
    await database.open();
    await new MigrateDatabase(new SqlMigrationSource(database, migrations), new SqliteMigrationJournal(database)).execute();
    repository = new SqliteCatalogRepository(database);
  });

  it('restitue à l’identique un catalogue enregistré', async () => {
    const source = fakeSource();
    await new SyncCatalog(source, repository, noAssets).execute({ language: 'fr' });

    const expected = (await source.fetchCatalog(CatalogVersion.of('1.10'), 'fr')).catalog;
    // Relecture depuis la base, sans le cache de l'instance qui a écrit.
    const stored = await new SqliteCatalogRepository(database).find('fr', CatalogVersion.of('1.10'));

    assert.ok(stored);
    assert.equal(stored.generatedAt.toISOString(), expected.generatedAt.toISOString());
    assert.deepEqual(stored.elements, expected.elements);
    assert.deepEqual(stored.rarities, expected.rarities);
    assert.deepEqual(stored.keywords, expected.keywords);
    assert.deepEqual(
      stored.cards.map((card) => card.data),
      expected.cards.map((card) => card.data),
    );
  });

  it('conserve le document brut et le plan de carte', async () => {
    await new SyncCatalog(fakeSource(), repository, noAssets).execute({ language: 'fr' });

    const row = database.connection.prepare("SELECT raw_document FROM catalog WHERE version = '1.10'").get();
    assert.equal(JSON.parse(String(row?.['raw_document'])).version, '1.10');
    assert.equal((await repository.findLayout())?.document['width'], 961);
  });

  it('renvoie la version la plus récente selon l’ordre numérique', async () => {
    const sync = new SyncCatalog(fakeSource(), repository, noAssets);
    await sync.execute({ language: 'fr' });
    await sync.execute({ language: 'fr', version: '1.9' });

    assert.equal((await repository.find('fr'))?.version.value, '1.10');
    assert.equal((await repository.find('fr', CatalogVersion.of('1.9')))?.cards[0]?.data.hp, 400);
    assert.equal(await repository.find('en'), undefined);
    assert.equal(await repository.has(CatalogVersion.of('1.9'), 'fr'), true);
  });

  it("n'enregistre rien si l'écriture échoue en cours de route", async () => {
    const { catalog, rawDocument } = await fakeSource().fetchCatalog(CatalogVersion.of('1.10'), 'fr');
    // Les talents sont écrits en dernier : l'échec survient après le catalogue et les cartes.
    database.connection.exec('ALTER TABLE card_talent RENAME TO card_talent_unavailable');

    await assert.rejects(repository.save(catalog, rawDocument), /card_talent/);

    assert.equal(await repository.has(CatalogVersion.of('1.10'), 'fr'), false);
    assert.equal(database.connection.prepare('SELECT COUNT(*) AS n FROM card').get()?.['n'], 0);
  });
});
