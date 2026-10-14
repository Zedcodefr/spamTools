import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import { parseCatalog, parseLayout } from '../infrastructure/spamgame/parseSpamGameDocuments.js';
import { cardDocument, cardsDocument, layoutDocument } from '../test-support/spamGameFixtures.js';
import { AssetPath } from './AssetPath.js';
import { CatalogVersion } from './CatalogVersion.js';

const catalog = () => parseCatalog(JSON.stringify(cardsDocument()));

describe('CatalogVersion', () => {
  it('compare les segments numériquement', () => {
    assert.equal(CatalogVersion.of('1.9').compareTo(CatalogVersion.of('1.10')), -1);
    assert.equal(CatalogVersion.of('1.21').compareTo(CatalogVersion.of('1.21.0')), 0);
    assert.equal(CatalogVersion.of('2').compareTo(CatalogVersion.of('1.99')), 1);
  });

  it('refuse un format inattendu', () => {
    assert.throws(() => CatalogVersion.of('v1.21'), DomainError);
  });
});

describe('AssetPath', () => {
  it('accepte un chemin relatif simple', () => {
    assert.equal(AssetPath.of('img/elements/fire.webp').value, 'img/elements/fire.webp');
  });

  for (const path of ['../secret', 'img/../../etc/passwd', '/etc/passwd', 'img//a.webp', 'img/a b.webp', 'C:\\a.webp']) {
    it(`refuse "${path}"`, () => {
      assert.throws(() => AssetPath.of(path), DomainError);
    });
  }
});

describe('Catalog', () => {
  it('trie les cartes par numéro', () => {
    const reversed = cardsDocument();
    reversed['cards'] = [...(reversed['cards'] as unknown[])].reverse();
    assert.deepEqual(parseCatalog(JSON.stringify(reversed)).cards.map((card) => card.number), [1, 12]);
  });

  it('refuse une carte qui référence un élément inconnu', () => {
    const document = cardsDocument({ cards: [cardDocument({ element: 'void' })] });
    assert.throws(() => parseCatalog(JSON.stringify(document)), /élément inconnu : "void"/);
  });

  it('refuse deux cartes avec le même identifiant', () => {
    const document = cardsDocument({ cards: [cardDocument(), cardDocument({ number: 2 })] });
    assert.throws(() => parseCatalog(JSON.stringify(document)), /carte en double/);
  });

  it('filtre par élément, rareté et texte sans tenir compte des accents ni de la casse', () => {
    assert.deepEqual(catalog().search({ element: 'water' }).map((card) => card.name), ['Hibernatus']);
    assert.deepEqual(catalog().search({ rarity: 'divine' }), []);
    assert.deepEqual(catalog().search({ text: 'SOUFFLE' }).map((card) => card.name), ['Esprit Feu']);
    assert.deepEqual(catalog().search({ text: 'chanceur' }).map((card) => card.name), ['Esprit Feu']);
    assert.equal(catalog().search({ text: '  ' }).length, 2);
  });

  it('liste les images des référentiels et des cartes', () => {
    const paths = catalog().assetPaths().map((path) => path.value);
    assert.ok(paths.includes('img/elements/water.webp'));
    assert.ok(paths.includes('img/frame/rarity-divine.webp'));
    assert.ok(paths.includes('img/keywords/icon-precision.webp'));
    assert.ok(paths.includes('img/illustrations/128/esprit_feu.webp'));
    assert.ok(paths.includes('img/skills/tox_luck.webp'));
  });
});

describe('CardLayout', () => {
  it('développe les modèles {element} et {rarity} avec les identifiants du catalogue', () => {
    const paths = parseLayout(JSON.stringify(layoutDocument())).assetPaths(catalog()).map((path) => path.value);
    assert.deepEqual(paths.sort(), [
      'img/frame/ability-bar.webp',
      'img/frame/body-fire.webp',
      'img/frame/body-water.webp',
      'img/frame/rarity-common.webp',
      'img/frame/rarity-divine.webp',
    ]);
  });
});
