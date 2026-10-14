import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Card } from './Card.ts';
import { indexCatalog, type CatalogOverview } from './Catalog.ts';
import { filterCards, hasActiveFilters, NO_FILTERS, sortCards } from './cardQuery.ts';

function card(overrides: Partial<Card>): Card {
  return {
    id: 'id',
    slug: 'slug',
    number: 1,
    name: 'Carte',
    element: 'fire',
    rarity: 'common',
    spamton: 10,
    hp: 500,
    resistances: {},
    artwork: { file: '', small: '', tiny: '', width: 1, height: 1, artist: { name: 'Atto', link: null } },
    abilities: [],
    skills: [],
    talents: [],
    lore: { species: '', region: '', era: '', text: '' },
    traits: { strikeElements: [], bonusElements: [], healElements: [], multiElement: false, specialAbilities: [], categories: [] },
    ...overrides,
  };
}

const cards = [
  card({ id: 'a', number: 1, name: 'Esprit Feu', hp: 500, spamton: 10 }),
  card({ id: 'b', number: 2, name: 'Élan', element: 'water', rarity: 'rare', hp: 750, spamton: 12 }),
  card({
    id: 'c',
    number: 3,
    name: 'Zorg',
    rarity: 'rare',
    hp: 500,
    artwork: { file: '', small: '', tiny: '', width: 1, height: 1, artist: { name: 'Mélo', link: null } },
    abilities: [
      {
        id: 'x', name: 'Brûlure', effect: 'Inflige Brûlure', effectRich: '', cooldown: 1, elements: [], precision: 100,
        critChance: 0, critMultiplier: 2, duration: 0, uses: 0, cooldownResetChance: 0, actions: [],
      },
    ],
  }),
];

const catalog = indexCatalog({
  rarities: [
    { id: 'common', name: 'Commune', order: 1, gem: '', textColor: null },
    { id: 'rare', name: 'Rare', order: 2, gem: '', textColor: null },
  ],
  elements: [],
  keywords: [],
  specialAbilities: [],
} as unknown as CatalogOverview);

const ids = (list: readonly Card[]) => list.map((entry) => entry.id);

describe('filterCards', () => {
  it('ne filtre rien par défaut', () => {
    assert.deepEqual(ids(filterCards(cards, NO_FILTERS)), ['a', 'b', 'c']);
    assert.equal(hasActiveFilters(NO_FILTERS), false);
  });

  it('cherche dans le nom, l’artiste et les capacités, sans accents', () => {
    assert.deepEqual(ids(filterCards(cards, { ...NO_FILTERS, text: 'elan' })), ['b']);
    assert.deepEqual(ids(filterCards(cards, { ...NO_FILTERS, text: 'MELO' })), ['c']);
    assert.deepEqual(ids(filterCards(cards, { ...NO_FILTERS, text: 'brulure' })), ['c']);
  });

  it('combine éléments, raretés et plages', () => {
    const filters = { ...NO_FILTERS, rarities: new Set(['rare']), hp: { min: 600, max: null } };
    assert.deepEqual(ids(filterCards(cards, filters)), ['b']);
    assert.deepEqual(ids(filterCards(cards, { ...NO_FILTERS, elements: new Set(['fire', 'nature']) })), ['a', 'c']);
    assert.deepEqual(ids(filterCards(cards, { ...NO_FILTERS, spamton: { min: null, max: 10 } })), ['a', 'c']);
    assert.equal(hasActiveFilters(filters), true);
  });
});

describe('filterCards : caractéristiques', () => {
  const traits = (overrides: Partial<Card['traits']>): Card['traits'] => ({
    strikeElements: [], bonusElements: [], healElements: [], multiElement: false, specialAbilities: [], categories: [],
    ...overrides,
  });
  const withTraits = [
    card({ id: 'x', traits: traits({ strikeElements: ['fire', 'earth'], specialAbilities: ['gel'], categories: ['affliction'] }) }),
    card({
      id: 'y',
      traits: traits({ strikeElements: ['fire'], healElements: ['light'], specialAbilities: ['gel', 'poison'], multiElement: true }),
    }),
  ];

  it('exige toutes les valeurs choisies dans un groupe', () => {
    const run = (filters: Partial<typeof NO_FILTERS>) => ids(filterCards(withTraits, { ...NO_FILTERS, ...filters }));
    assert.deepEqual(run({ strikeElements: new Set(['fire']) }), ['x', 'y']);
    assert.deepEqual(run({ strikeElements: new Set(['fire', 'earth']) }), ['x']);
    assert.deepEqual(run({ specialAbilities: new Set(['gel', 'poison']) }), ['y']);
    assert.deepEqual(run({ healElements: new Set(['light']), categories: new Set(['affliction']) }), []);
    assert.deepEqual(run({ multiElement: true }), ['y']);
  });
});

describe('sortCards', () => {
  it('trie par clé puis par numéro', () => {
    assert.deepEqual(ids(sortCards(cards, { key: 'hp', descending: true }, catalog)), ['b', 'a', 'c']);
    assert.deepEqual(ids(sortCards(cards, { key: 'rarity', descending: false }, catalog)), ['a', 'b', 'c']);
    assert.deepEqual(ids(sortCards(cards, { key: 'name', descending: false }, catalog)), ['b', 'a', 'c']);
  });
});
