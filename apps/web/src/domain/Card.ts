/**
 * Données des cartes telles que servies par l'API (/api/cards).
 * Les chemins d'images sont relatifs à /api/assets/.
 */

export interface CardAction {
  readonly effect: string;
  readonly kind: string;
  readonly min: number;
  readonly max: number;
  readonly element: string | null;
  readonly chain: number;
  readonly percent: boolean;
}

export interface Ability {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly effectRich: string;
  readonly cooldown: number;
  readonly elements: readonly string[];
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly duration: number;
  readonly uses: number;
  readonly cooldownResetChance: number;
  readonly actions: readonly CardAction[];
}

/** Tox : effet passif porté par la carte. */
export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly effectRich: string;
  readonly rarity: string;
  readonly element: string | null;
  readonly value: number;
  readonly icon: string | null;
}

export interface Talent {
  readonly slot: number;
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly effectRich: string;
  readonly elements: readonly string[];
  readonly grantsSkill: string | null;
  readonly actions: readonly CardAction[];
}

export interface Card {
  readonly id: string;
  readonly slug: string;
  readonly number: number;
  readonly name: string;
  readonly element: string;
  readonly rarity: string;
  readonly spamton: number;
  readonly hp: number;
  /** Pourcentage de dégâts réduits, par élément. */
  readonly resistances: Readonly<Record<string, number>>;
  readonly artwork: {
    readonly file: string;
    readonly small: string;
    readonly tiny: string;
    readonly width: number;
    readonly height: number;
    /** À créditer partout où l'illustration est affichée (conditions d'utilisation des données). */
    readonly artist: { readonly name: string; readonly link: string | null };
  };
  readonly abilities: readonly Ability[];
  readonly skills: readonly Skill[];
  readonly talents: readonly Talent[];
  readonly lore: { readonly species: string; readonly region: string; readonly era: string; readonly text: string };
  /** Caractéristiques calculées à l'import (voir CardTraits). */
  readonly traits: CardTraits;
}

/** Caractéristiques dérivées des cartes, calculées une fois à l'import côté serveur. */
export interface CardTraits {
  /** Éléments dans lesquels ses capacités infligent des dégâts. */
  readonly strikeElements: readonly string[];
  /** Bonus élémentaires de ses capacités et de ses passifs naturels (Cœurs, Sac de frappe), tox ou talent. */
  readonly bonusElements: readonly string[];
  /** Éléments dans lesquels ses capacités soignent. */
  readonly healElements: readonly string[];
  /** Une capacité agit dans un élément aléatoire ou dans tous les éléments, ou Cœur aléatoire naturel. */
  readonly multiElement: boolean;
  /** Clés de SpecialAbility. */
  readonly specialAbilities: readonly string[];
  /** Identifiants de TraitCategory. */
  readonly categories: readonly string[];
}
