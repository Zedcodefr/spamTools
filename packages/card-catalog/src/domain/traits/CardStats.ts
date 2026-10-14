/**
 * Statistiques chiffrées d'une carte, en espérance, calculées à l'import pour l'analyse des decks.
 * Les valeurs « par tour » supposent que chaque capacité est utilisée dès qu'elle est prête :
 * une capacité de recharge N sert une fois tous les N tours.
 */

/** Montant par élément (identifiant d'élément -> valeur). */
export type ElementAmounts = Readonly<Record<string, number>>;

/** Effet présent sur la carte mais non chiffrable sans simuler une partie. */
export interface UnquantifiedEffect {
  readonly source: string;
  readonly reason: string;
}

export interface StatContribution {
  /** Ajout aux résistances de la carte (%). */
  readonly resistances: ElementAmounts;
  /** Ajout aux résistances de toutes les cartes alliées, elle comprise (%). */
  readonly allyResistances: ElementAmounts;
  /** Dégâts infligés par tour, hors bonus élémentaires accumulés. */
  readonly damagePerTurn: ElementAmounts;
  /** Soins par tour, hors bonus élémentaires accumulés. */
  readonly healPerTurn: ElementAmounts;
  /** Éléments générés par tour (bonus élémentaires). */
  readonly generatedPerTurn: ElementAmounts;
  /** Éléments consommés par tour (coûts des capacités). */
  readonly consumedPerTurn: ElementAmounts;
  /** Éléments obtenus une fois, en début de partie. */
  readonly startingBonus: ElementAmounts;
  readonly unquantified: readonly UnquantifiedEffect[];
}

export interface CardStats {
  /** Carte seule : résistances de base, capacités, tox. */
  readonly base: StatContribution;
  /**
   * Coefficient appliqué aux bonus élémentaires pour les dégâts et soins de cette carte :
   * 2 avec le tox Multiplicateur (« bonus élémentaires doublés »), 1 sinon.
   */
  readonly bonusFactor: number;
  /** Apport de chaque talent, par emplacement (un seul est choisi dans un deck). */
  readonly talents: Readonly<Record<string, StatContribution>>;
}
