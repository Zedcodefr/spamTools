/**
 * Analyse d'un deck à partir des statistiques chiffrées de ses cartes (calculées à l'import).
 * Toutes les valeurs sont des espérances ; « par tour » suppose que les 4 cartes agissent
 * et utilisent chaque capacité dès qu'elle est prête.
 *
 * Bonus élémentaires : chaque élément a un stock, qui part des bonus de départ puis gagne à
 * chaque tour les éléments générés et perd ceux consommés (jamais sous 0). Chaque point de
 * stock d'un élément augmente de BONUS_RATE les dégâts et soins de cet élément ; un élément
 * généré au tour t profite à partir du tour t + 1.
 */

/** +10 % de dégâts et de soins par point de bonus élémentaire accumulé. */
export const BONUS_RATE = 0.1;
/** Horizon de projection par défaut (tours). */
export const DEFAULT_TURNS = 10;
export const MAX_TURNS = 50;

export type ElementAmounts = Readonly<Record<string, number>>;

/** Apport d'une carte ou d'un talent (même forme que les stats du catalogue). */
export interface StatContribution {
  readonly resistances: ElementAmounts;
  readonly allyResistances: ElementAmounts;
  readonly damagePerTurn: ElementAmounts;
  readonly healPerTurn: ElementAmounts;
  readonly generatedPerTurn: ElementAmounts;
  readonly consumedPerTurn: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly unquantified: readonly { readonly source: string; readonly reason: string }[];
}

/** Une carte du deck : ses stats et celles du talent choisi. */
export interface DeckCardStats {
  readonly cardId: string;
  readonly cardName: string;
  readonly talentName: string;
  readonly base: StatContribution;
  readonly talent: StatContribution;
  /** Coefficient appliqué aux bonus pour cette carte (2 avec Multiplicateur). */
  readonly bonusFactor: number;
}

/** État d'un tour de la projection. */
export interface TurnProjection {
  readonly turn: number;
  /** Stock de bonus élémentaires disponible pendant ce tour. */
  readonly bonusStock: ElementAmounts;
  readonly damage: ElementAmounts;
  readonly heal: ElementAmounts;
  readonly totalDamage: number;
  readonly totalHeal: number;
}

export interface DeckCardSummary {
  readonly cardId: string;
  readonly cardName: string;
  readonly talentName: string;
  readonly resistances: ElementAmounts;
  readonly damagePerTurn: number;
  readonly generatedPerTurn: number;
}

export interface DeckAnalysis {
  readonly cardCount: number;
  /** Résistance moyenne par élément (%), talents et bonus d'équipe compris. */
  readonly averageResistances: ElementAmounts;
  /** Éléments où la résistance moyenne est la plus basse. */
  readonly weaknesses: readonly string[];
  /** Dégâts par tour sans bonus élémentaires. */
  readonly damagePerTurn: ElementAmounts;
  readonly totalDamagePerTurn: number;
  /** Soins par tour sans bonus élémentaires. */
  readonly healPerTurn: ElementAmounts;
  readonly totalHealPerTurn: number;
  /** Projection tour par tour, bonus accumulés compris. */
  readonly turns: readonly TurnProjection[];
  /** Moyennes sur la projection, bonus accumulés compris. */
  readonly averageDamagePerTurn: ElementAmounts;
  readonly averageTotalDamagePerTurn: number;
  readonly averageHealPerTurn: ElementAmounts;
  readonly averageTotalHealPerTurn: number;
  readonly generatedPerTurn: ElementAmounts;
  readonly consumedPerTurn: ElementAmounts;
  /** Généré moins consommé, par tour. */
  readonly netPerTurn: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly cards: readonly DeckCardSummary[];
  readonly unquantified: readonly { readonly cardName: string; readonly source: string; readonly reason: string }[];
}

export function analyzeDeck(cards: readonly DeckCardStats[], turnCount: number = DEFAULT_TURNS): DeckAnalysis {
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
  const weaknesses = Object.entries(averageResistances)
    .filter(([, value]) => value === lowest)
    .map(([element]) => element);

  const total = (field: keyof Omit<StatContribution, 'unquantified'>) =>
    sum(cards.flatMap((card) => [card.base[field], card.talent[field]]));
  const damagePerTurn = total('damagePerTurn');
  const healPerTurn = total('healPerTurn');
  const generatedPerTurn = total('generatedPerTurn');
  const consumedPerTurn = total('consumedPerTurn');
  const startingBonus = total('startingBonus');
  const turns = project(cards, startingBonus, generatedPerTurn, consumedPerTurn, turnCount);
  const averageOf = (field: 'damage' | 'heal') =>
    scale(sum(turns.map((turn) => turn[field])), 1 / Math.max(1, turns.length));
  const averageDamagePerTurn = averageOf('damage');
  const averageHealPerTurn = averageOf('heal');

  return {
    cardCount: cards.length,
    averageResistances,
    weaknesses: cards.length === 0 ? [] : weaknesses,
    damagePerTurn: round(damagePerTurn),
    totalDamagePerTurn: roundValue(totalOf(damagePerTurn)),
    healPerTurn: round(healPerTurn),
    totalHealPerTurn: roundValue(totalOf(healPerTurn)),
    turns,
    averageDamagePerTurn: round(averageDamagePerTurn),
    averageTotalDamagePerTurn: roundValue(totalOf(averageDamagePerTurn)),
    averageHealPerTurn: round(averageHealPerTurn),
    averageTotalHealPerTurn: roundValue(totalOf(averageHealPerTurn)),
    generatedPerTurn: round(generatedPerTurn),
    consumedPerTurn: round(consumedPerTurn),
    netPerTurn: round(sum([generatedPerTurn, scale(consumedPerTurn, -1)])),
    startingBonus: round(startingBonus),
    cards: cards.map((card, index) => ({
      cardId: card.cardId,
      cardName: card.cardName,
      talentName: card.talentName,
      resistances: round(cardResistances[index] ?? {}),
      damagePerTurn: roundValue(totalOf(sum([card.base.damagePerTurn, card.talent.damagePerTurn]))),
      generatedPerTurn: roundValue(totalOf(sum([card.base.generatedPerTurn, card.talent.generatedPerTurn]))),
    })),
    unquantified: cards.flatMap((card) =>
      [...card.base.unquantified, ...card.talent.unquantified].map((note) => ({ cardName: card.cardName, ...note })),
    ),
  };
}

/** Projection tour par tour : stock de bonus, puis dégâts et soins majorés par ce stock. */
function project(
  cards: readonly DeckCardStats[],
  startingBonus: ElementAmounts,
  generatedPerTurn: ElementAmounts,
  consumedPerTurn: ElementAmounts,
  turnCount: number,
): TurnProjection[] {
  const turns: TurnProjection[] = [];
  let stock: Record<string, number> = { ...startingBonus };
  for (let turn = 1; turn <= Math.min(Math.max(1, Math.floor(turnCount)), MAX_TURNS); turn++) {
    const boosted = (field: 'damagePerTurn' | 'healPerTurn') =>
      sum(
        cards.map((card) =>
          Object.fromEntries(
            Object.entries(sum([card.base[field], card.talent[field]])).map(([element, value]) => [
              element,
              value * (1 + BONUS_RATE * card.bonusFactor * (stock[element] ?? 0)),
            ]),
          ),
        ),
      );
    const damage = boosted('damagePerTurn');
    const heal = boosted('healPerTurn');
    turns.push({
      turn,
      bonusStock: round(stock),
      damage: round(damage),
      heal: round(heal),
      totalDamage: roundValue(totalOf(damage)),
      totalHeal: roundValue(totalOf(heal)),
    });
    const next = sum([stock, generatedPerTurn, scale(consumedPerTurn, -1)]);
    stock = Object.fromEntries(Object.entries(next).map(([element, value]) => [element, Math.max(0, value)]));
  }
  return turns;
}

function sum(amounts: readonly ElementAmounts[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of amounts) {
    for (const [element, value] of Object.entries(entry)) {
      result[element] = (result[element] ?? 0) + value;
    }
  }
  return result;
}

function scale(amounts: ElementAmounts, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).map(([element, value]) => [element, value * factor]));
}

function totalOf(amounts: ElementAmounts): number {
  return Object.values(amounts).reduce((a, b) => a + b, 0);
}

function round(amounts: ElementAmounts): ElementAmounts {
  return Object.fromEntries(Object.entries(amounts).map(([element, value]) => [element, roundValue(value)]));
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}
