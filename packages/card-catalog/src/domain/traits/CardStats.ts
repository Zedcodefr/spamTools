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
  /**
   * Nombre moyen de cartes adverses touchées par la ligne : dégâts totaux = valeur × targets
   * (une cible : 1 ; zone : 4 ; cible au hasard sur tout le terrain : 1/2).
   */
  readonly targets: number;
  /**
   * Part de la valeur reçue en moyenne par une carte adverse donnée (« cible unique ») :
   * une cible ou zone : 1 ; cible au hasard parmi les 4 adverses : 1/4 ; parmi les 8 du terrain : 1/8.
   */
  readonly singleTarget: number;
  /** Poids de la ligne : 1, ou 1 / nombre d'options pour une capacité à « Choix ». */
  readonly weight: number;
  /** Effet déclenché seulement en cas de coup critique (« + Bonus Eau (+2) en cas de coup critique »). */
  readonly onCritOnly: boolean;
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
  /**
   * Recharge N : la capacité est prête pour la première fois au tour N, puis N tours après
   * chaque utilisation (une recharge de 1 sert à chaque tour, dès le tour 1).
   */
  readonly cooldown: number;
  /** Écho : probabilité (0 à 1) qu'elle reste prête au tour suivant son utilisation. */
  readonly echoChance: number;
  /** Tours moyens entre deux utilisations en régime établi (indicatif). */
  readonly period: number;
  /** En % : précision, chance de critique ; multiplicateur des coups critiques. */
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damage: readonly EffectLine[];
  readonly heal: readonly EffectLine[];
  /**
   * Soin rendu à la carte adverse touchée (« Soigne la carte ciblée » dans une capacité d'attaque,
   * ex. Épine Médusine) : calculé comme un soin, il se déduit des dégâts.
   */
  readonly opponentHeal: readonly EffectLine[];
  /** AoE propre à la capacité (mot-clé dans son texte) : part reçue par chaque carte adjacente à la cible. */
  readonly adjacentShare?: number;
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
  /**
   * Éléments générés à chaque attaque subie (Sac de frappe : +1 dans l'élément de la carte).
   * Dépend de la partie : l'analyse en donne une fourchette (jamais frappée / toujours frappée).
   */
  readonly bonusPerHit: ElementAmounts;
  /** Éléments obtenus une fois, en début de partie. */
  readonly startingBonus: ElementAmounts;
  /** Chance d'Écho ajoutée à toutes les capacités de la carte (talent Roulette : 0,1) ; absent : aucune. */
  readonly echoBonus?: number;
  /**
   * Passif AoE (tox de la carte, ou donné par un talent) : toutes ses capacités atteignent aussi les cartes
   * adjacentes à la cible, à hauteur de cette part (0,2 : 20 %) ; absent : aucun.
   */
  readonly adjacentShare?: number;
  /** Passif Inversement : les dégâts de la carte deviennent des soins, et ses soins des dégâts. */
  readonly invertsDamageAndHeal?: boolean;
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
