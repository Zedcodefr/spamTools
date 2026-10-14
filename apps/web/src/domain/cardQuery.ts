import type { Card } from './Card.ts';
import type { CatalogIndex } from './Catalog.ts';

export interface CardFilters {
  /** Nom, artiste, ou nom/effet d'une capacité, tox ou talent. */
  readonly text: string;
  /**
   * Un ensemble vide ne filtre pas. Élément et rareté (une seule valeur par carte) :
   * la carte doit avoir l'une des valeurs choisies. Les autres groupes : elle doit
   * les avoir toutes.
   */
  readonly elements: ReadonlySet<string>;
  readonly rarities: ReadonlySet<string>;
  readonly strikeElements: ReadonlySet<string>;
  readonly bonusElements: ReadonlySet<string>;
  readonly healElements: ReadonlySet<string>;
  /** Catégories de capacités particulières (ex. multicible). */
  readonly categories: ReadonlySet<string>;
  /** Clés de capacités particulières. */
  readonly specialAbilities: ReadonlySet<string>;
  /** Seulement les cartes multiélément. */
  readonly multiElement: boolean;
  readonly hp: NumberRange;
  readonly spamton: NumberRange;
}

export interface NumberRange {
  readonly min: number | null;
  readonly max: number | null;
}

export type SortKey = 'number' | 'name' | 'rarity' | 'hp' | 'spamton';

export interface CardSort {
  readonly key: SortKey;
  readonly descending: boolean;
}

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  number: 'Numéro',
  name: 'Nom',
  rarity: 'Rareté',
  hp: 'PV',
  spamton: 'Spamton',
};

export const NO_FILTERS: CardFilters = {
  text: '',
  elements: new Set(),
  rarities: new Set(),
  strikeElements: new Set(),
  bonusElements: new Set(),
  healElements: new Set(),
  categories: new Set(),
  specialAbilities: new Set(),
  multiElement: false,
  hp: { min: null, max: null },
  spamton: { min: null, max: null },
};

export function hasActiveFilters(filters: CardFilters): boolean {
  return (
    filters.text.trim() !== '' ||
    SELECTION_FILTERS.some((name) => filters[name].size > 0) ||
    filters.multiElement ||
    [filters.hp, filters.spamton].some((range) => range.min !== null || range.max !== null)
  );
}

/** Filtres à sélection multiple. */
export const SELECTION_FILTERS = [
  'elements',
  'rarities',
  'strikeElements',
  'bonusElements',
  'healElements',
  'categories',
  'specialAbilities',
] as const satisfies readonly (keyof CardFilters)[];

export type SelectionFilter = (typeof SELECTION_FILTERS)[number];

export function filterCards(cards: readonly Card[], filters: CardFilters): Card[] {
  const needle = normalize(filters.text.trim());
  return cards.filter((card) => {
    const { traits } = card;
    return (
      matchesAny(filters.elements, [card.element]) &&
      matchesAny(filters.rarities, [card.rarity]) &&
      matchesAll(filters.strikeElements, traits.strikeElements) &&
      matchesAll(filters.bonusElements, traits.bonusElements) &&
      matchesAll(filters.healElements, traits.healElements) &&
      matchesAll(filters.categories, traits.categories) &&
      matchesAll(filters.specialAbilities, traits.specialAbilities) &&
      (!filters.multiElement || traits.multiElement) &&
      inRange(card.hp, filters.hp) &&
      inRange(card.spamton, filters.spamton) &&
      (needle === '' || searchableTexts(card).some((text) => normalize(text).includes(needle)))
    );
  });
}

function matchesAll(selection: ReadonlySet<string>, values: readonly string[]): boolean {
  for (const selected of selection) {
    if (!values.includes(selected)) {
      return false;
    }
  }
  return true;
}

function matchesAny(selection: ReadonlySet<string>, values: Iterable<string>): boolean {
  if (selection.size === 0) {
    return true;
  }
  for (const value of values) {
    if (selection.has(value)) {
      return true;
    }
  }
  return false;
}

export function sortCards(cards: readonly Card[], sort: CardSort, catalog: CatalogIndex): Card[] {
  const value = (card: Card): number | string => {
    switch (sort.key) {
      case 'number':
        return card.number;
      case 'name':
        return card.name;
      case 'rarity':
        return catalog.rarities.get(card.rarity)?.order ?? 0;
      case 'hp':
        return card.hp;
      case 'spamton':
        return card.spamton;
    }
  };
  const direction = sort.descending ? -1 : 1;
  return [...cards].sort((a, b) => {
    const [left, right] = [value(a), value(b)];
    const compared =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right, 'fr')
        : Number(left) - Number(right);
    // À égalité, ordre du jeu (numéro) pour un résultat stable.
    return compared !== 0 ? compared * direction : a.number - b.number;
  });
}

function inRange(value: number, range: NumberRange): boolean {
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

function searchableTexts(card: Card): string[] {
  return [
    card.name,
    card.artwork.artist.name,
    ...[...card.abilities, ...card.skills, ...card.talents].flatMap((entry) => [entry.name, entry.effect]),
  ];
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
