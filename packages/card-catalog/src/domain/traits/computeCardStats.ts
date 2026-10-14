import type { Ability, CardAction, CardData, Talent } from '../Card.js';
import type { CardStats, ElementAmounts, StatContribution, UnquantifiedEffect } from './CardStats.js';

/** Nombre de cartes adverses touchées par une attaque de zone. */
export const ENEMY_CARDS = 4;

const BONUS_EFFECT = /^AddAllPlayerAttack/;
const CARD_ELEMENT_DAMAGE = 'DamageWithCardElement';
/** Dégâts dont une part dépend de la partie (PV manquants du lanceur). */
const VARIABLE_DAMAGE = 'DamageCasterHP';
const CHOICE_REFERENCE = '{kw:choice}';
const NO_EFFECT = '_NULL';

// Textes normalisés : sans accents, minuscules.
const CONDITION = /tant que|chaque fois|des qu|quand|lorsqu|\bsi\b|a chaque|par tour/;
const COST = /\[cout ([^\]]+)\]/;
const RANDOM_ELEMENT = /element aleatoire|elements? au hasard/;
const EVERY_ELEMENT = /chaque element|tous les elements/;

export interface PassiveGrant {
  /** Clé de capacité particulière (ex. « cœur de feu »). */
  readonly key: string;
  readonly label: string;
  readonly description: string | null;
}

export interface StatsContext {
  /** Éléments de base, sur lesquels se répartit un élément aléatoire. */
  readonly baseElements: readonly string[];
  /** Nom d'élément normalisé -> identifiant (pour lire les coûts « [Coût 10 Feu] »). */
  readonly elementIdByName: ReadonlyMap<string, string>;
  /** Passif accordé par un talent, s'il est connu. */
  grantedPassive(talent: Talent): PassiveGrant | undefined;
  /** Élément d'un passif élémentaire (« cœur de feu » -> fire). */
  passiveElement(key: string): string | undefined;
  /** Clé de capacité particulière d'un nom affiché. */
  keyOf(label: string): string;
}

const PUNCHING_BAG_KEY = 'sac de frappe';
/** Tox « Multiplicateur » : bonus élémentaires doublés pour les dégâts et soins de la carte. */
const MULTIPLIER_KEY = 'multiplicateur';

/**
 * Statistiques chiffrées d'une carte : celles de la carte seule et l'apport de chacun de ses talents.
 */
export function computeCardStats(card: CardData, context: StatsContext): CardStats {
  const base = new Contribution();
  for (const [element, value] of Object.entries(card.resistances)) {
    base.add('resistances', element, value);
  }
  for (const ability of card.abilities) {
    addAbility(base, ability, card, context);
  }
  for (const skill of card.skills) {
    addPassive(base, context.keyOf(skill.name), skill.name, skill.value, card, context);
  }

  const talents: Record<string, StatContribution> = {};
  for (const talent of card.talents) {
    talents[String(talent.slot)] = talentContribution(talent, card, context).toStats();
  }
  const bonusFactor = card.skills.some((skill) => context.keyOf(skill.name) === MULTIPLIER_KEY) ? 2 : 1;
  return { base: base.toStats(), bonusFactor, talents };
}

function addAbility(stats: Contribution, ability: Ability, card: CardData, context: StatsContext): void {
  if (ability.uses > 0) {
    stats.note(ability.name, `usage limité (${ability.uses} fois par partie) : non compté par tour`);
    return;
  }
  const text = normalize(ability.effect);
  const period = expectedPeriod(ability);
  const hitChance = ability.precision / 100;
  const critFactor = 1 + (ability.critChance / 100) * (ability.critMultiplier - 1);

  for (const { action, weight } of weightedActions(ability)) {
    if (action.percent) {
      stats.note(ability.name, 'effet en pourcentage des PV : non chiffré');
      continue;
    }
    const value = (action.min + action.max) / 2;
    if (action.kind === 'damage') {
      if (action.effect === VARIABLE_DAMAGE) {
        stats.note(ability.name, 'part des dégâts selon les PV manquants : seule la base est comptée');
      }
      const targets = action.effect === 'DamageAll' ? ENEMY_CARDS : 1;
      const shares = elementShares(action, card, text, context);
      if (shares.length === 0) {
        stats.note(ability.name, 'élément des dégâts indéterminé');
      }
      for (const [element, share] of shares) {
        stats.add('damagePerTurn', element, (value * targets * hitChance * critFactor * weight * share) / period);
      }
    } else if (action.kind === 'heal') {
      const shares = elementShares(action, card, text, context);
      if (shares.length === 0) {
        stats.note(ability.name, 'soin sans élément : non compté dans les soins par élément');
      }
      for (const [element, share] of shares) {
        stats.add('healPerTurn', element, (value * hitChance * critFactor * weight * share) / period);
      }
    } else if (BONUS_EFFECT.test(action.effect)) {
      for (const [element, share] of elementShares(action, card, text, context)) {
        stats.add('generatedPerTurn', element, (value * weight * share) / period);
      }
    }
  }

  const cost = COST.exec(text)?.[1];
  if (cost !== undefined) {
    for (const part of cost.split('&')) {
      const [, amount, name] = /(\d+(?:[.,]\d+)?)\s+(.+)/.exec(part.trim()) ?? [];
      const element = name === undefined ? undefined : context.elementIdByName.get(name.trim());
      if (amount === undefined || element === undefined) {
        stats.note(ability.name, `coût non élémentaire (${part.trim()}) : non compté`);
      } else {
        stats.add('consumedPerTurn', element, Number(amount.replace(',', '.')) / period);
      }
    }
  }
}

/** Passif naturel (tox ou accordé par un talent) : Cœurs élémentaires, Sac de frappe. */
function addPassive(
  stats: Contribution,
  key: string,
  label: string,
  perTurn: number,
  card: CardData,
  context: StatsContext,
): boolean {
  const element = context.passiveElement(key);
  if (element !== undefined && perTurn > 0) {
    stats.add('generatedPerTurn', element, perTurn);
    return true;
  }
  if (key === PUNCHING_BAG_KEY) {
    stats.note(label, "+1 dans l'élément de la carte à chaque attaque subie : dépend de la partie, non compté");
    return true;
  }
  return false;
}

function talentContribution(talent: Talent, card: CardData, context: StatsContext): Contribution {
  const stats = new Contribution();
  const granted = context.grantedPassive(talent);
  if (granted !== undefined) {
    const perTurn = Number(/\(\+(\d+(?:[.,]\d+)?)\)/.exec(granted.description ?? '')?.[1]?.replace(',', '.') ?? 1);
    if (addPassive(stats, granted.key, talent.name, perTurn, card, context)) {
      return stats;
    }
  }

  const text = normalize(talent.effect);
  const conditional = CONDITION.test(text);
  let quantified = false;
  for (const action of talent.actions) {
    const value = (action.min + action.max) / 2;
    if (action.effect === 'AddCardResistance' && action.element !== null) {
      if (!conditional) {
        stats.add('resistances', action.element, value);
        quantified = true;
      }
    } else if (action.effect === 'AddOppCardResistance' && action.element !== null && /allie/.test(text)) {
      if (!conditional) {
        stats.add('allyResistances', action.element, value);
        quantified = true;
      }
    } else if (BONUS_EFFECT.test(action.effect) && !conditional) {
      for (const [element, share] of elementShares(action, card, text, context)) {
        stats.add('startingBonus', element, value * share);
        quantified = true;
      }
    }
  }
  if (conditional && !quantified && talent.actions.some((action) => action.effect !== NO_EFFECT)) {
    stats.note(talent.name, 'effet conditionnel : non chiffré');
  }
  return stats;
}

/**
 * Durée moyenne entre deux utilisations. Avec Écho, la capacité reste disponible
 * (prochain tour) avec la probabilité indiquée ; sinon elle attend sa recharge.
 */
function expectedPeriod(ability: Ability): number {
  const echo = ability.cooldownResetChance / 100;
  const cooldown = Math.max(1, ability.cooldown);
  return echo + (1 - echo) * cooldown;
}

/**
 * Actions comptées et leur poids : toutes pour une capacité simple ; pour un « Choix »,
 * chaque option (numéro d'enchaînement) pèse 1 / nombre d'options.
 */
function weightedActions(ability: Ability): { action: CardAction; weight: number }[] {
  const actions = ability.actions.filter((action) => action.effect !== NO_EFFECT);
  if (!ability.effectRich.includes(CHOICE_REFERENCE)) {
    return actions.map((action) => ({ action, weight: 1 }));
  }
  const options = new Set(actions.map((action) => action.chain));
  return actions.map((action) => ({ action, weight: 1 / Math.max(1, options.size) }));
}

/** Élément(s) d'une action et leur part : explicite, celui de la carte, tous, ou un au hasard. */
function elementShares(action: CardAction, card: CardData, text: string, context: StatsContext): [string, number][] {
  if (action.element !== null) {
    return [[action.element, 1]];
  }
  if (action.effect === CARD_ELEMENT_DAMAGE) {
    return [[card.element, 1]];
  }
  const elements = context.baseElements;
  if (EVERY_ELEMENT.test(text)) {
    return elements.map((element) => [element, 1]);
  }
  if (/Random/.test(action.effect) || RANDOM_ELEMENT.test(text)) {
    return elements.map((element) => [element, 1 / elements.length]);
  }
  return [];
}

type AmountField = Exclude<keyof StatContribution, 'unquantified'>;

class Contribution {
  private readonly amounts: Record<AmountField, Record<string, number>> = {
    resistances: {},
    allyResistances: {},
    damagePerTurn: {},
    healPerTurn: {},
    generatedPerTurn: {},
    consumedPerTurn: {},
    startingBonus: {},
  };
  private readonly notes = new Map<string, UnquantifiedEffect>();

  add(field: AmountField, element: string, value: number): void {
    const amounts = this.amounts[field];
    amounts[element] = (amounts[element] ?? 0) + value;
  }

  note(source: string, reason: string): void {
    this.notes.set(`${source}|${reason}`, { source, reason });
  }

  toStats(): StatContribution {
    const round = (amounts: Record<string, number>): ElementAmounts =>
      Object.fromEntries(
        Object.entries(amounts)
          .filter(([, value]) => value !== 0)
          .map(([element, value]) => [element, Math.round(value * 1000) / 1000]),
      );
    return {
      resistances: round(this.amounts.resistances),
      allyResistances: round(this.amounts.allyResistances),
      damagePerTurn: round(this.amounts.damagePerTurn),
      healPerTurn: round(this.amounts.healPerTurn),
      generatedPerTurn: round(this.amounts.generatedPerTurn),
      consumedPerTurn: round(this.amounts.consumedPerTurn),
      startingBonus: round(this.amounts.startingBonus),
      unquantified: [...this.notes.values()],
    };
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
