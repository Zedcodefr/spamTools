/**
 * Caractéristiques dérivées des cartes, calculées une fois à l'import (voir analyzeTraits)
 * et conservées avec le catalogue pour filtrer sans recalcul.
 */

import type { CardStats } from './CardStats.js';

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
  /** Nom normalisé (sans accents ni casse) : identique quelle que soit la rareté ou la source. */
  readonly key: string;
  readonly label: string;
  readonly category: string;
  readonly description: string | null;
  readonly icon: TraitIcon;
}

export interface CardTraits {
  /** Éléments dans lesquels ses capacités infligent des dégâts. */
  readonly strikeElements: readonly string[];
  /** Bonus élémentaires de ses capacités et de ses passifs naturels (Cœurs, Sac de frappe), tox ou talent. */
  readonly bonusElements: readonly string[];
  /** Éléments dans lesquels ses capacités soignent. */
  readonly healElements: readonly string[];
  /**
   * Multiélément : une capacité agit dans un élément aléatoire ou dans tous les éléments
   * à la fois, ou la carte a naturellement un Cœur aléatoire.
   */
  readonly multiElement: boolean;
  /** Clés de SpecialAbility. */
  readonly specialAbilities: readonly string[];
  /** Catégories de ses capacités particulières. */
  readonly categories: readonly string[];
  /** Statistiques chiffrées (dégâts, éléments générés, résistances...), pour l'analyse des decks. */
  readonly stats: CardStats;
}

export interface CatalogTraits {
  /** Version des règles d'analyse : un changement de règles impose de recalculer. */
  readonly analysisVersion: number;
  /** Catégories et capacités présentes sur au moins une carte. */
  readonly categories: readonly TraitCategory[];
  readonly specialAbilities: readonly SpecialAbility[];
  readonly byCard: Readonly<Record<string, CardTraits>>;
}
