/** Référentiels du catalogue (/api/catalog). */

export interface CardElement {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly icon: string;
  readonly color: string;
}

export interface Rarity {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly gem: string;
  readonly textColor: string | null;
}

export interface Keyword {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly descriptionRich: string;
  readonly tooltip: string;
  readonly color: string | null;
  readonly icon: string | null;
}

/** Icône : image officielle des données du jeu, ou symbole générique (nom d'icône Lucide). */
export type TraitIcon = { readonly type: 'asset'; readonly path: string } | { readonly type: 'symbol'; readonly name: string };

export interface TraitCategory {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: TraitIcon;
}

/** Passif ou mécanique notable (Disparition, Provocation, Attaque de zone...). */
export interface SpecialAbility {
  readonly key: string;
  readonly label: string;
  readonly category: string;
  readonly description: string | null;
  readonly icon: TraitIcon;
}

export interface CatalogOverview {
  readonly version: string;
  readonly language: string;
  readonly generatedAt: string;
  /** De la plus récente à la plus ancienne. */
  readonly availableVersions: readonly string[];
  readonly cardCount: number;
  readonly elements: readonly CardElement[];
  readonly rarities: readonly Rarity[];
  readonly keywords: readonly Keyword[];
  /** Catégories et capacités particulières présentes sur au moins une carte. */
  readonly traitCategories: readonly TraitCategory[];
  readonly specialAbilities: readonly SpecialAbility[];
}

/** Accès rapide aux référentiels par identifiant. */
export interface CatalogIndex {
  readonly elements: ReadonlyMap<string, CardElement>;
  readonly rarities: ReadonlyMap<string, Rarity>;
  readonly keywords: ReadonlyMap<string, Keyword>;
  readonly specialAbilities: ReadonlyMap<string, SpecialAbility>;
}

export function indexCatalog(catalog: CatalogOverview): CatalogIndex {
  return {
    elements: new Map(catalog.elements.map((element) => [element.id, element])),
    rarities: new Map(catalog.rarities.map((rarity) => [rarity.id, rarity])),
    keywords: new Map(catalog.keywords.map((keyword) => [keyword.id, keyword])),
    specialAbilities: new Map(catalog.specialAbilities.map((special) => [special.key, special])),
  };
}
