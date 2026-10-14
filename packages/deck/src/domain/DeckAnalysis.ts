/**
 * Analyse d'un deck : simulation tour par tour, en espérance, à partir du modèle chiffré de
 * chaque carte (calculé à l'import). Les 4 cartes agissent à chaque tour et utilisent chaque
 * capacité dès qu'elle est prête. Une capacité de recharge N est prête pour la première fois au
 * tour N, puis N tours après chaque utilisation ; l'Écho la laisse prête au tour suivant avec sa
 * probabilité (suivie exactement : probabilité d'être prête à chaque tour).
 *
 * À chaque tour, dans l'ordre :
 * 1. renforts « à chaque tour » des talents, puis renforts des capacités utilisées ce tour,
 *    pondérés par leur précision (un renfort ne s'applique que si la capacité touche) ;
 * 2. éléments générés (précision et critique compris) et consommés : le stock compte dès ce tour ;
 * 3. dégâts et soins : précision, critique, dégâts de base et croissance des capacités accumulés,
 *    majorés de BONUS_RATE par point de stock de leur élément (×2 avec Multiplicateur).
 */

/** +10 % de dégâts et de soins par point de bonus élémentaire accumulé. */
export const BONUS_RATE = 0.1;
/**
 * Borne haute des bonus « par coup reçu » (Sac de frappe) : la carte est frappée à chaque tour,
 * une fois. La borne basse (jamais frappée) est l'analyse principale.
 */
export const HITS_PER_TURN_WHEN_ALWAYS_HIT = 1;
/** Horizon de simulation par défaut (tours). */
export const DEFAULT_TURNS = 10;
export const MAX_TURNS = 50;

export type ElementAmounts = Readonly<Record<string, number>>;

export interface EffectLine {
  readonly value: number;
  readonly elements: ElementAmounts;
  /** Dégâts totaux = valeur × targets (zone : 4). */
  readonly targets: number;
  /** Part reçue par une carte adverse donnée (zone : 1 ; cible au hasard parmi 4 : 1/4). */
  readonly singleTarget: number;
  readonly weight: number;
  /** Effet déclenché seulement en cas de coup critique. */
  readonly onCritOnly: boolean;
}

export type BoostStat = 'precision' | 'critChance' | 'critMultiplier' | 'baseDamage' | 'baseHeal';

export interface Boost {
  readonly stat: BoostStat;
  readonly amount: number;
  readonly target: 'self' | 'allies' | 'dps' | 'randomAlly';
  readonly chance: number;
}

export interface AbilityModel {
  readonly name: string;
  readonly cooldown: number;
  readonly echoChance: number;
  readonly period: number;
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damage: readonly EffectLine[];
  readonly heal: readonly EffectLine[];
  readonly bonus: readonly EffectLine[];
  readonly cost: ElementAmounts;
  readonly growth: { readonly damage: number; readonly heal: number; readonly bonus: number };
  readonly boosts: readonly Boost[];
}

/** Apport d'une carte ou d'un talent (même forme que le modèle du catalogue). */
export interface StatContribution {
  readonly resistances: ElementAmounts;
  readonly allyResistances: ElementAmounts;
  readonly abilities: readonly AbilityModel[];
  readonly passiveBonusPerTurn: ElementAmounts;
  /** Éléments générés à chaque attaque subie (Sac de frappe). */
  readonly bonusPerHit: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly startingBoosts: readonly Boost[];
  readonly boostsPerTurn: readonly Boost[];
  readonly unquantified: readonly { readonly source: string; readonly reason: string }[];
}

/** Apport nul : carte sans talent. */
export const NO_CONTRIBUTION: StatContribution = {
  resistances: {},
  allyResistances: {},
  abilities: [],
  passiveBonusPerTurn: {},
  bonusPerHit: {},
  startingBonus: {},
  startingBoosts: [],
  boostsPerTurn: [],
  unquantified: [],
};

/** Une carte du deck : son modèle et celui du talent choisi (NO_CONTRIBUTION sans talent). */
export interface DeckCardStats {
  readonly cardId: string;
  readonly cardName: string;
  readonly talentName: string | null;
  readonly base: StatContribution;
  readonly talent: StatContribution;
  /** Coefficient appliqué aux bonus pour cette carte (2 avec Multiplicateur). */
  readonly bonusFactor: number;
}

export interface DeckAnalysisOptions {
  readonly turns?: number | undefined;
  /** Carte qui reçoit les renforts ciblés (précision, critique, dégâts de base). */
  readonly dpsCardId?: string | null | undefined;
}

/** Renforts cumulés d'une carte : points de précision et de critique, multiplicateur, valeurs de base. */
export interface CardBoosts {
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly baseDamage: number;
  readonly baseHeal: number;
}

export interface TurnProjection {
  readonly turn: number;
  /** Stock de bonus élémentaires pendant ce tour (générés ce tour compris). */
  readonly bonusStock: ElementAmounts;
  /** Dégâts totaux, toutes cibles confondues. */
  readonly damage: ElementAmounts;
  readonly heal: ElementAmounts;
  readonly totalDamage: number;
  /** Dégâts reçus en moyenne par une carte adverse donnée. */
  readonly totalSingleTargetDamage: number;
  readonly totalHeal: number;
}

export interface DeckCardSummary {
  readonly cardId: string;
  readonly cardName: string;
  readonly talentName: string | null;
  readonly isDps: boolean;
  readonly resistances: ElementAmounts;
  /** Moyennes par tour sur la simulation : dégâts totaux, et reçus par une carte adverse donnée. */
  readonly damagePerTurn: number;
  readonly singleTargetDamagePerTurn: number;
  readonly healPerTurn: number;
  readonly generatedPerTurn: number;
  /** Renforts cumulés au dernier tour simulé. */
  readonly finalBoosts: CardBoosts;
}

export interface DeckAnalysis {
  readonly cardCount: number;
  readonly dpsCardId: string | null;
  /** Résistance moyenne par élément (%), talents et bonus d'équipe compris. */
  readonly averageResistances: ElementAmounts;
  /** Éléments où la résistance moyenne est la plus basse. */
  readonly weaknesses: readonly string[];
  /** Moyennes par tour sur la simulation, tout compris : dégâts totaux, toutes cibles confondues… */
  readonly damagePerTurn: ElementAmounts;
  readonly totalDamagePerTurn: number;
  /** … et dégâts reçus par une carte adverse donnée (zone : une part ; cible au hasard : sa probabilité). */
  readonly singleTargetDamagePerTurn: ElementAmounts;
  readonly totalSingleTargetDamagePerTurn: number;
  readonly healPerTurn: ElementAmounts;
  readonly totalHealPerTurn: number;
  readonly generatedPerTurn: ElementAmounts;
  readonly consumedPerTurn: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly turns: readonly TurnProjection[];
  readonly cards: readonly DeckCardSummary[];
  readonly unquantified: readonly { readonly cardName: string; readonly source: string; readonly reason: string }[];
  /**
   * Borne haute si le deck a des bonus « par coup reçu » (Sac de frappe) : mêmes mesures quand
   * les cartes concernées sont frappées à chaque tour. L'analyse principale suppose qu'elles ne le
   * sont jamais. Absent sinon.
   */
  readonly whenAlwaysHit: DeckScenario | null;
}

/** Mesures d'un scénario alternatif de la simulation. */
export interface DeckScenario {
  readonly hitsPerTurn: number;
  readonly totalDamagePerTurn: number;
  readonly totalSingleTargetDamagePerTurn: number;
  readonly totalHealPerTurn: number;
  readonly damagePerTurn: ElementAmounts;
  readonly generatedPerTurn: ElementAmounts;
  readonly turns: readonly TurnProjection[];
}

const NO_BOOSTS: CardBoosts = { precision: 0, critChance: 0, critMultiplier: 0, baseDamage: 0, baseHeal: 0 };

export function analyzeDeck(cards: readonly DeckCardStats[], options: DeckAnalysisOptions = {}): DeckAnalysis {
  const neverHit = simulate(cards, options, 0);
  const hitSensitive = cards.some((card) =>
    [card.base.bonusPerHit, card.talent.bonusPerHit].some((amounts) => Object.keys(amounts).length > 0),
  );
  if (!hitSensitive) {
    return { ...neverHit, whenAlwaysHit: null };
  }
  const alwaysHit = simulate(cards, options, HITS_PER_TURN_WHEN_ALWAYS_HIT);
  return {
    ...neverHit,
    whenAlwaysHit: {
      hitsPerTurn: HITS_PER_TURN_WHEN_ALWAYS_HIT,
      totalDamagePerTurn: alwaysHit.totalDamagePerTurn,
      totalSingleTargetDamagePerTurn: alwaysHit.totalSingleTargetDamagePerTurn,
      totalHealPerTurn: alwaysHit.totalHealPerTurn,
      damagePerTurn: alwaysHit.damagePerTurn,
      generatedPerTurn: alwaysHit.generatedPerTurn,
      turns: alwaysHit.turns,
    },
  };
}

/** Simulation complète, chaque carte à bonus « par coup reçu » subissant `hitsPerTurn` attaques par tour. */
function simulate(
  cards: readonly DeckCardStats[],
  options: DeckAnalysisOptions,
  hitsPerTurn: number,
): Omit<DeckAnalysis, 'whenAlwaysHit'> {
  const turnCount = Math.min(Math.max(1, Math.floor(options.turns ?? DEFAULT_TURNS)), MAX_TURNS);
  const dpsIndex = cards.findIndex((card) => card.cardId === options.dpsCardId);
  const notes = cards.flatMap((card) =>
    [...card.base.unquantified, ...card.talent.unquantified].map((note) => ({ cardName: card.cardName, ...note })),
  );

  // Résistances
  const teamResistance = sum(cards.flatMap((card) => [card.base.allyResistances, card.talent.allyResistances]));
  const cardResistances = cards.map((card) => sum([card.base.resistances, card.talent.resistances, teamResistance]));
  const elements = [...new Set(cardResistances.flatMap((resistances) => Object.keys(resistances)))];
  const averageResistances = round(
    Object.fromEntries(
      elements.map((element) => [
        element,
        cardResistances.reduce((total, resistances) => total + (resistances[element] ?? 0), 0) / Math.max(1, cards.length),
      ]),
    ),
  );
  const lowest = Math.min(...Object.values(averageResistances));

  // Simulation
  const abilities = cards.map((card) => [...card.base.abilities, ...card.talent.abilities]);
  const boosts: CardBoosts[] = cards.map(() => ({ ...NO_BOOSTS }));
  const uses = abilities.map((list) => list.map(() => 0));
  const schedules = abilities.map((list) => list.map((ability) => new CooldownSchedule(ability)));
  const perCard = cards.map(() => ({ damage: 0, singleTargetDamage: 0, heal: 0, generated: 0 }));
  const unappliedTargeted = new Set<string>();

  const applyBoost = (from: number, boost: Boost, rate: number, source: string) => {
    const amount = boost.amount * boost.chance * rate;
    const add = (index: number, share: number) => {
      const current = boosts[index] as CardBoosts;
      boosts[index] = { ...current, [boost.stat]: current[boost.stat] + amount * share };
    };
    if (boost.target === 'self') {
      add(from, 1);
    } else if (boost.target === 'allies') {
      cards.forEach((_, index) => add(index, 1));
    } else if (boost.target === 'randomAlly') {
      cards.forEach((_, index) => add(index, 1 / cards.length));
    } else if (dpsIndex >= 0) {
      add(dpsIndex, 1);
    } else {
      unappliedTargeted.add(`${cards[from]?.cardName}|${source}`);
    }
  };
  cards.forEach((card, index) => {
    for (const boost of [...card.base.startingBoosts, ...card.talent.startingBoosts]) {
      applyBoost(index, boost, 1, card.talentName ?? card.cardName);
    }
  });

  let stock: Record<string, number> = sum(cards.flatMap((card) => [card.base.startingBonus, card.talent.startingBonus]));
  const startingBonus = round(stock);
  const totals: Record<'damage' | 'singleTargetDamage' | 'heal' | 'generated' | 'consumed', Record<string, number>> = {
    damage: {},
    singleTargetDamage: {},
    heal: {},
    generated: {},
    consumed: {},
  };
  const turns: TurnProjection[] = [];

  for (let turn = 1; turn <= turnCount; turn++) {
    // Probabilité que chaque capacité soit prête, donc utilisée, à ce tour.
    const ready = schedules.map((list) => list.map((schedule) => schedule.readyChance()));
    const usedNow = (index: number, abilityIndex: number) => ready[index]?.[abilityIndex] ?? 0;

    // 1. Renforts du tour.
    cards.forEach((card, index) => {
      for (const boost of [...card.base.boostsPerTurn, ...card.talent.boostsPerTurn]) {
        applyBoost(index, boost, 1, card.talentName ?? card.cardName);
      }
      abilities[index]?.forEach((ability, abilityIndex) => {
        const landed = usedNow(index, abilityIndex) * hitChance(ability, boosts[index] as CardBoosts);
        for (const boost of ability.boosts) {
          applyBoost(index, boost, landed, ability.name);
        }
      });
    });

    // 2. Éléments générés et consommés.
    const generated: Record<string, number> = {};
    const consumed: Record<string, number> = {};
    cards.forEach((card, index) => {
      const byCard = sum([
        card.base.passiveBonusPerTurn,
        card.talent.passiveBonusPerTurn,
        scale(card.base.bonusPerHit, hitsPerTurn),
        scale(card.talent.bonusPerHit, hitsPerTurn),
      ]);
      abilities[index]?.forEach((ability, abilityIndex) => {
        const rate = usedNow(index, abilityIndex);
        const growth = ability.growth.bonus * (uses[index]?.[abilityIndex] ?? 0);
        const cardBoosts = boosts[index] as CardBoosts;
        for (const line of ability.bonus) {
          // Bonus « en cas de coup critique » : précision × chance de critique ; sinon espérance de critique.
          const chance = line.onCritOnly
            ? hitChance(ability, cardBoosts) * critChance(ability, cardBoosts)
            : successFactor(ability, cardBoosts);
          addInto(byCard, scale(line.elements, (line.value + growth) * line.weight * rate * chance));
        }
        addInto(consumed, scale(ability.cost, rate));
      });
      addInto(generated, byCard);
      perCard[index]!.generated += totalOf(byCard);
    });
    stock = clampPositive(sum([stock, generated, scale(consumed, -1)]));

    // 3. Dégâts et soins.
    const damage: Record<string, number> = {};
    const singleTargetDamage: Record<string, number> = {};
    const heal: Record<string, number> = {};
    cards.forEach((card, index) => {
      const cardBoosts = boosts[index] as CardBoosts;
      const boostOf = (element: string) => 1 + BONUS_RATE * card.bonusFactor * (stock[element] ?? 0);
      abilities[index]?.forEach((ability, abilityIndex) => {
        const used = uses[index]?.[abilityIndex] ?? 0;
        const factor = successFactor(ability, cardBoosts) * usedNow(index, abilityIndex);
        const effect = (
          lines: readonly EffectLine[],
          base: number,
          into: Record<string, number>,
          reach: (line: EffectLine) => number,
        ) => {
          let total = 0;
          for (const line of lines) {
            for (const [element, share] of Object.entries(line.elements)) {
              const value = (line.value + base) * reach(line) * line.weight * share * factor * boostOf(element);
              into[element] = (into[element] ?? 0) + value;
              total += value;
            }
          }
          return total;
        };
        const damageBase = ability.growth.damage * used + cardBoosts.baseDamage;
        const cardTotals = perCard[index]!;
        cardTotals.damage += effect(ability.damage, damageBase, damage, (line) => line.targets);
        cardTotals.singleTargetDamage += effect(ability.damage, damageBase, singleTargetDamage, (line) => line.singleTarget);
        cardTotals.heal += effect(ability.heal, ability.growth.heal * used + cardBoosts.baseHeal, heal, (line) => line.targets);
        // Croissance « après utilisation » : comptée à partir de l'utilisation suivante.
        uses[index]![abilityIndex] = used + usedNow(index, abilityIndex);
      });
    });

    schedules.forEach((list) => list.forEach((schedule) => schedule.endTurn()));
    addInto(totals.damage, damage);
    addInto(totals.singleTargetDamage, singleTargetDamage);
    addInto(totals.heal, heal);
    addInto(totals.generated, generated);
    addInto(totals.consumed, consumed);
    turns.push({
      turn,
      bonusStock: round(stock),
      damage: round(damage),
      heal: round(heal),
      totalDamage: roundValue(totalOf(damage)),
      totalSingleTargetDamage: roundValue(totalOf(singleTargetDamage)),
      totalHeal: roundValue(totalOf(heal)),
    });
  }

  const average = (amounts: ElementAmounts) => round(scale(amounts, 1 / turnCount));
  const damagePerTurn = average(totals.damage);
  const singleTargetDamagePerTurn = average(totals.singleTargetDamage);
  const healPerTurn = average(totals.heal);

  return {
    cardCount: cards.length,
    dpsCardId: dpsIndex >= 0 ? (cards[dpsIndex]?.cardId ?? null) : null,
    averageResistances,
    weaknesses:
      cards.length === 0 ? [] : Object.keys(averageResistances).filter((element) => averageResistances[element] === lowest),
    damagePerTurn,
    totalDamagePerTurn: roundValue(totalOf(damagePerTurn)),
    singleTargetDamagePerTurn,
    totalSingleTargetDamagePerTurn: roundValue(totalOf(singleTargetDamagePerTurn)),
    healPerTurn,
    totalHealPerTurn: roundValue(totalOf(healPerTurn)),
    generatedPerTurn: average(totals.generated),
    consumedPerTurn: average(totals.consumed),
    startingBonus,
    turns,
    cards: cards.map((card, index) => ({
      cardId: card.cardId,
      cardName: card.cardName,
      talentName: card.talentName,
      isDps: index === dpsIndex,
      resistances: round(cardResistances[index] ?? {}),
      damagePerTurn: roundValue((perCard[index]?.damage ?? 0) / turnCount),
      singleTargetDamagePerTurn: roundValue((perCard[index]?.singleTargetDamage ?? 0) / turnCount),
      healPerTurn: roundValue((perCard[index]?.heal ?? 0) / turnCount),
      generatedPerTurn: roundValue((perCard[index]?.generated ?? 0) / turnCount),
      finalBoosts: roundBoosts(boosts[index] ?? NO_BOOSTS),
    })),
    unquantified: [
      ...notes,
      ...[...unappliedTargeted].map((key) => {
        const [cardName = '', source = ''] = key.split('|');
        return { cardName, source, reason: 'renfort ciblé non appliqué : choisissez un DPS' };
      }),
    ],
  };
}

/**
 * Calendrier d'une capacité, en probabilités : `remaining[k]` = probabilité qu'il reste k tours
 * avant qu'elle soit prête (0 : prête ce tour). Départ : prête au tour N (recharge N).
 * Après utilisation : prête au tour suivant avec la chance d'Écho, sinon N tours plus tard.
 */
class CooldownSchedule {
  private remaining: number[];
  private readonly cooldown: number;
  private readonly echo: number;

  constructor(ability: AbilityModel) {
    this.cooldown = Math.max(1, Math.round(ability.cooldown));
    this.echo = Math.min(1, Math.max(0, ability.echoChance));
    this.remaining = Array.from({ length: this.cooldown }, (_, k) => (k === this.cooldown - 1 ? 1 : 0));
  }

  readyChance(): number {
    return this.remaining[0] ?? 0;
  }

  /** Fin du tour : la capacité prête est utilisée, les autres se rapprochent d'un tour. */
  endTurn(): void {
    const used = this.readyChance();
    const next = this.remaining.map(() => 0);
    for (let k = 1; k < this.remaining.length; k++) {
      next[k - 1] = (next[k - 1] ?? 0) + (this.remaining[k] ?? 0);
    }
    next[0] = (next[0] ?? 0) + used * this.echo;
    next[this.cooldown - 1] = (next[this.cooldown - 1] ?? 0) + used * (1 - this.echo);
    this.remaining = next;
  }
}

/** Probabilité qu'une capacité touche : sa précision, renforts compris (plafonnée à 100 %). */
function hitChance(ability: AbilityModel, boosts: CardBoosts): number {
  return clampRatio((ability.precision + boosts.precision) / 100);
}

/** Chance de coup critique d'une capacité, renforts compris (plafonnée à 100 %). */
function critChance(ability: AbilityModel, boosts: CardBoosts): number {
  return clampRatio((ability.critChance + boosts.critChance) / 100);
}

/** Espérance de réussite × critique d'une capacité, renforts compris (plafonnés à 100 %). */
function successFactor(ability: AbilityModel, boosts: CardBoosts): number {
  const hit = hitChance(ability, boosts);
  const crit = critChance(ability, boosts);
  return hit * (1 + crit * (ability.critMultiplier + boosts.critMultiplier - 1));
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampPositive(amounts: ElementAmounts): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).map(([element, value]) => [element, Math.max(0, value)]));
}

function sum(amounts: readonly ElementAmounts[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of amounts) {
    addInto(result, entry);
  }
  return result;
}

function addInto(target: Record<string, number>, amounts: ElementAmounts): void {
  for (const [element, value] of Object.entries(amounts)) {
    target[element] = (target[element] ?? 0) + value;
  }
}

function scale(amounts: ElementAmounts, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).map(([element, value]) => [element, value * factor]));
}

function totalOf(amounts: ElementAmounts): number {
  return Object.values(amounts).reduce((a, b) => a + b, 0);
}

function round(amounts: ElementAmounts): ElementAmounts {
  return Object.fromEntries(
    Object.entries(amounts)
      .filter(([, value]) => Math.abs(value) > 1e-9)
      .map(([element, value]) => [element, roundValue(value)]),
  );
}

function roundBoosts(boosts: CardBoosts): CardBoosts {
  return {
    precision: roundValue(boosts.precision),
    critChance: roundValue(boosts.critChance),
    critMultiplier: roundValue(boosts.critMultiplier),
    baseDamage: roundValue(boosts.baseDamage),
    baseHeal: roundValue(boosts.baseHeal),
  };
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}
