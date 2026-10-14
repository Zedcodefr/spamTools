import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cardDocument, cardsDocument, indexDocument } from '../../test-support/spamGameFixtures.js';
import { InvalidSourceDataError } from './JsonReader.js';
import { parseCatalog, parseIndex } from './parseSpamGameDocuments.js';

describe('parseIndex', () => {
  it('lit les versions, langues et chemins', () => {
    const index = parseIndex(JSON.stringify(indexDocument()));
    assert.equal(index.latest.value, '1.21');
    assert.deepEqual(index.versions.map((version) => version.value), ['1.20', '1.21']);
    assert.deepEqual(index.languages, ['fr', 'en']);
    assert.equal(index.cardsPathTemplate, '{version}/cards.{language}.json');
  });

  it('refuse un schema non pris en charge', () => {
    assert.throws(() => parseIndex(JSON.stringify(indexDocument({ schema: 2 }))), /schema 2/);
  });
});

describe('parseCatalog', () => {
  it('traduit une carte complète', () => {
    const card = parseCatalog(JSON.stringify(cardsDocument())).findCard('18bca5cf-7aa1-421c-85ec-4ed0b6a8ca70');
    assert.ok(card);
    assert.equal(card.data.artwork.artist.name, 'Atto');
    assert.equal(card.data.abilities[0]?.actions[0]?.percent, false);
    assert.equal(card.data.talents[0]?.actions[0]?.percent, true);
    assert.equal(card.data.skills[0]?.element, null);
    assert.deepEqual(card.data.resistances, { fire: 10, water: 10 });
  });

  it('accepte un artiste sans lien et un mot-clé sans icône', () => {
    const document = cardsDocument({
      cards: [cardDocument({ artwork: { ...(cardDocument()['artwork'] as object), artist: { name: 'X', link: null } } })],
      keywords: [{ id: 'k', title: 'K', description: '', descriptionRich: '', tooltip: 'glossary', decoration: { color: '#fff' } }],
    });
    const catalog = parseCatalog(JSON.stringify(document));
    assert.equal(catalog.cards[0]?.data.artwork.artist.link, null);
    assert.equal(catalog.keywords[0]?.icon, null);
  });

  it('indique le chemin du champ fautif', () => {
    const document = cardsDocument({ cards: [cardDocument({ hp: '500' })] });
    assert.throws(
      () => parseCatalog(JSON.stringify(document)),
      (error: unknown) => error instanceof InvalidSourceDataError && error.message === '$.cards[0].hp : un nombre attendu',
    );
  });

  it('refuse un JSON illisible', () => {
    assert.throws(() => parseCatalog('<html>'), /Document cartes illisible/);
  });
});
