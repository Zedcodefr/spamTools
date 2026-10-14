/**
 * Modèle chiffré d'une carte, calculé à l'import pour l'analyse des decks : ce que fait
 * chaque capacité, à quelle fréquence, et ce qu'elle renforce. L'analyse d'un deck simule
 * ensuite la partie tour par tour, en espérance (bonus cumulés, boosts de précision...).
 */

/** Montant par élément (identifiant d'élément -> valeur). */
export type ElementAmounts = Readonly<Record<string, number>>;

/** Effet présent sur la carte mais non chiffrable sans simuler une vraie partie. */
export interface UnquantifiedEffect {
  readonly source: string;
  readonly reason: string;
}

/** Une ligne d'effet (dégâts, soin ou bonus élémentaire) d'une capacité. */
export interface EffectLine {
  /** Valeur moyenne par utilisation (moyenne de [min, max]). */
  readonly value: number;
  /** Part de chaque élément : 1 pour un élément fixe, 1/6 chacun pour un élément aléatoire. */
  readonly elements: ElementAmounts;
  /** Nombre de cibles touchées (attaque de zone : 4). */
  readonly targets: number;
  /** Poids de la ligne : 1, ou 1 / nombre d'options pour une capacité à « Choix ». */
  readonly weight: number;
}

export type BoostStat = 'precision' | 'critChance' | 'critMultiplier' | 'baseDamage' | 'baseHeal';

/**
 * Renfort d'une statistique, cumulable.
 * - self : la carte qui le lance ; allies : toutes les cartes alliées ;
 * - dps : la carte alliée ciblée, supposée être le DPS choisi ; randomAlly : une alliée au hasard.
 */
export interface Boost {
  readonly stat: BoostStat;
  /** Points de % (précision, critique), points de multiplicateur, ou valeur ajoutée (dégâts/soins de base). */
  readonly amount: number;
  readonly target: 'self' | 'allies' | 'dps' | 'randomAlly';
  /** Probabilité que le renfort s'applique (1, ou la chance de critique pour « en cas de coup critique »). */
  readonly chance: number;
}

export interface AbilityModel {
  readonly name: string;
  /** Tours moyens entre deux utilisations : recharge N -> tous les N tours (Écho : moins). */
  readonly period: number;
  /** En % : précision, chance de critique ; multiplicateur des coups critiques. */
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damage: readonly EffectLine[];
  readonly heal: readonly EffectLine[];
  readonly bonus: readonly EffectLine[];
  /** Éléments consommés par utilisation (« [Coût 10 Feu] »). */
  readonly cost: ElementAmounts;
  /** Croissance par utilisation de la capacité elle-même (« la valeur de base augmente de 5 »). */
  readonly growth: { readonly damage: number; readonly heal: number; readonly bonus: number };
  /** Renforts appliqués à chaque utilisation. */
  readonly boosts: readonly Boost[];
}

export interface StatContribution {
  /** Ajout aux résistances de la carte (%). */
  readonly resistances: ElementAmounts;
  /** Ajout aux résistances de toutes les cartes alliées, elle comprise (%). */
  readonly allyResistances: ElementAmounts;
  readonly abilities: readonly AbilityModel[];
  /** Éléments générés à chaque tour sans action (Cœurs). */
  readonly passiveBonusPerTurn: ElementAmounts;
  /** Éléments obtenus une fois, en début de partie. */
  readonly startingBonus: ElementAmounts;
  /** Renforts obtenus une fois en début de partie, et à chaque tour. */
  readonly startingBoosts: readonly Boost[];
  readonly boostsPerTurn: readonly Boost[];
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
