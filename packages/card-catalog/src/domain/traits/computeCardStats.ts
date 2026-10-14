import type { Ability, CardAction, CardData, Talent } from '../Card.js';
import type {
  AbilityModel,
  Boost,
  BoostStat,
  CardStats,
  EffectLine,
  ElementAmounts,
  StatContribution,
  UnquantifiedEffect,
} from './CardStats.js';

/** Nombre de cartes adverses touchées par une attaque de zone. */
export const ENEMY_CARDS = 4;

const BONUS_EFFECT = /^AddAllPlayerAttack/;
/** Bonus dont la valeur de base augmente à chaque utilisation (« La valeur de base du bonus augmente de 1 »). */
const GROWING_BONUS_EFFECT = /^AddAllPlayerAttackCountActivation/;
const CARD_ELEMENT_DAMAGE = 'DamageWithCardElement';
/** Dégâts dont une part dépend de la partie (PV manquants du lanceur). */
const VARIABLE_DAMAGE = 'DamageCasterHP';
/** Croissance de la capacité elle-même à chaque utilisation. */
const ABILITY_GROWTH = 'AddAbilityBaseDamage';
const CHOICE_REFERENCE = '{kw:choice}';
const NO_EFFECT = '_NULL';

type BoostScope = 'self' | 'allies' | 'target';

/**
 * Renforts de statistiques, par code d'action. `sign` : la précision est codée en « Miss »
 * (chance de rater), un -5 de Miss est donc +5 de précision. `scope` : self = le lanceur,
 * allies = toutes les cartes alliées, target = la carte ciblée (alliée ou adverse selon le texte).
 */
const BOOST_ACTIONS: Readonly<Record<string, { stat: BoostStat; sign: 1 | -1; scope: BoostScope }>> = {
  AddCardCriticChance: { stat: 'critChance', sign: 1, scope: 'self' },
  AddCardMiss: { stat: 'precision', sign: -1, scope: 'self' },
  AddCardCriticRatio: { stat: 'critMultiplier', sign: 1, scope: 'self' },
  AddCardBaseDamage: { stat: 'baseDamage', sign: 1, scope: 'self' },
  AddAllPlayerCritick: { stat: 'critChance', sign: 1, scope: 'allies' },
  AddAllPlayerMiss: { stat: 'precision', sign: -1, scope: 'allies' },
  AddOppCardCriticChance: { stat: 'critChance', sign: 1, scope: 'target' },
  AddOppCardMiss: { stat: 'precision', sign: -1, scope: 'target' },
  AddOppCardCriticRatio: { stat: 'critMultiplier', sign: 1, scope: 'target' },
  AddOppCardBaseDamage: { stat: 'baseDamage', sign: 1, scope: 'target' },
};

// Textes normalisés : sans accents, minuscules.
const CONDITION = /tant que|chaque fois|des qu|quand|lorsqu|\bsi\b|a chaque attaque|apres utilisation/;
const EVERY_TURN = /par tour|a chaque tour/;
const COST = /\[cout ([^\]]+)\]/;
const RANDOM_ELEMENT = /element aleatoire|elements? au hasard/;
const EVERY_ELEMENT = /chaque element|tous les elements/;
const ON_CRIT = /en cas de (coup )?critique/;
const ENEMY = /advers/;
const ALL_ALLIES = /toutes les cartes alliees|toutes vos cartes|toutes les cartes du terrain|toutes les cartes du lanceur/;
const RANDOM_ALLY = /aleatoirement sur une carte alliee|une carte alliee (au hasard|aleatoire)/;
/** Renfort des dégâts « et des soins » de base. */
const HEAL_TOO = /soins/;
/** Croissance des dégâts de la capacité elle-même (« les dégâts de base de cette attaque augmentent »). */
const THIS_ATTACK = /cette attaque/;

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
 * Modèle chiffré d'une carte : celui de la carte seule et l'apport de chacun de ses talents.
 */
export function computeCardStats(card: CardData, context: StatsContext): CardStats {
  const base = new Contribution();
  for (const [element, value] of Object.entries(card.resistances)) {
    base.addAmount('resistances', element, value);
  }
  for (const ability of card.abilities) {
    const model = abilityModel(ability, card, context, base);
    if (model !== undefined) {
      base.abilities.push(model);
    }
  }
  for (const skill of card.skills) {
    addPassive(base, context.keyOf(skill.name), skill.name, skill.value, context);
  }

  const talents: Record<string, StatContribution> = {};
  for (const talent of card.talents) {
    talents[String(talent.slot)] = talentContribution(talent, card, context).toStats();
  }
  const bonusFactor = card.skills.some((skill) => context.keyOf(skill.name) === MULTIPLIER_KEY) ? 2 : 1;
  return { base: base.toStats(), bonusFactor, talents };
}

function abilityModel(
  ability: Ability,
  card: CardData,
  context: StatsContext,
  notes: Contribution,
): AbilityModel | undefined {
  if (ability.uses > 0) {
    notes.note(ability.name, `usage limité (${ability.uses} fois par partie) : non compté par tour`);
    return undefined;
  }
  const text = normalize(ability.effect);
  const damage: EffectLine[] = [];
  const heal: EffectLine[] = [];
  const bonus: EffectLine[] = [];
  const growth = { damage: 0, heal: 0, bonus: 0 };
  const boosts: Boost[] = [];
  const healsOnly =
    ability.actions.some((action) => action.kind === 'heal') &&
    !ability.actions.some((action) => action.kind === 'damage');

  for (const { action, weight } of weightedActions(ability)) {
    if (action.percent) {
      notes.note(ability.name, 'effet en pourcentage des PV : non chiffré');
      continue;
    }
    const value = (action.min + action.max) / 2;
    const line = (targets = 1): EffectLine | undefined => {
      const elements = elementShares(action, card, text, context);
      return Object.keys(elements).length === 0 ? undefined : { value, elements, targets, weight };
    };

    if (action.kind === 'damage') {
      if (action.effect === VARIABLE_DAMAGE) {
        notes.note(ability.name, 'part des dégâts selon les PV manquants : seule la base est comptée');
      }
      const damageLine = line(action.effect === 'DamageAll' ? ENEMY_CARDS : 1);
      if (damageLine === undefined) {
        notes.note(ability.name, 'élément des dégâts indéterminé');
      } else {
        damage.push(damageLine);
      }
    } else if (action.kind === 'heal') {
      const healLine = line();
      if (healLine === undefined) {
        notes.note(ability.name, 'soin sans élément : non compté dans les soins par élément');
      } else {
        heal.push(healLine);
      }
    } else if (BONUS_EFFECT.test(action.effect)) {
      const bonusLine = line();
      if (bonusLine !== undefined) {
        bonus.push(bonusLine);
      }
      if (GROWING_BONUS_EFFECT.test(action.effect)) {
        const step = /augmente de (\d+(?:[.,]\d+)?)/.exec(text)?.[1]?.replace(',', '.');
        growth.bonus += (step === undefined ? action.min : Number(step)) * weight;
      }
    } else if (action.effect === ABILITY_GROWTH) {
      growth[healsOnly ? 'heal' : 'damage'] += value * weight;
    } else if (action.effect === 'AddCardBaseDamage' && THIS_ATTACK.test(text)) {
      growth.damage += value * weight;
    } else {
      boosts.push(...toBoosts(action, value * weight, text, ability.critChance / 100));
    }
  }

  const cost: Record<string, number> = {};
  const costText = COST.exec(text)?.[1];
  if (costText !== undefined) {
    for (const part of costText.split('&')) {
      const [, amount, name] = /(\d+(?:[.,]\d+)?)\s+(.+)/.exec(part.trim()) ?? [];
      const element = name === undefined ? undefined : context.elementIdByName.get(name.trim());
      if (amount === undefined || element === undefined) {
        notes.note(ability.name, `coût non élémentaire (${part.trim()}) : non compté`);
      } else {
        cost[element] = (cost[element] ?? 0) + Number(amount.replace(',', '.'));
      }
    }
  }

  return {
    name: ability.name,
    period: expectedPeriod(ability),
    precision: ability.precision,
    critChance: ability.critChance,
    critMultiplier: ability.critMultiplier,
    damage,
    heal,
    bonus,
    cost,
    growth,
    boosts,
  };
}

/** Renforts de précision, critique ou dégâts de base portés par une action (aucun s'il vise l'adversaire). */
function toBoosts(action: CardAction, value: number, text: string, critChance: number): Boost[] {
  const definition = BOOST_ACTIONS[action.effect];
  if (definition === undefined) {
    return [];
  }
  let target: Boost['target'];
  if (definition.scope === 'self') {
    target = 'self';
  } else if (definition.scope === 'allies' || ALL_ALLIES.test(text)) {
    target = 'allies';
  } else if (ENEMY.test(text)) {
    return [];
  } else {
    target = RANDOM_ALLY.test(text) ? 'randomAlly' : 'dps';
  }
  const boost = { amount: value * definition.sign, target, chance: ON_CRIT.test(text) ? critChance : 1 };
  return definition.stat === 'baseDamage' && HEAL_TOO.test(text)
    ? [
        { ...boost, stat: 'baseDamage' },
        { ...boost, stat: 'baseHeal' },
      ]
    : [{ ...boost, stat: definition.stat }];
}

/** Passif naturel (tox ou accordé par un talent) : Cœurs élémentaires, Sac de frappe. */
function addPassive(stats: Contribution, key: string, label: string, perTurn: number, context: StatsContext): boolean {
  const element = context.passiveElement(key);
  if (element !== undefined && perTurn > 0) {
    stats.addAmount('passiveBonusPerTurn', element, perTurn);
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
    if (addPassive(stats, granted.key, talent.name, perTurn, context)) {
      return stats;
    }
  }

  const text = normalize(talent.effect);
  const conditional = CONDITION.test(text);
  const everyTurn = EVERY_TURN.test(text);
  let quantified = false;
  for (const action of talent.actions) {
    const value = (action.min + action.max) / 2;
    if (action.effect === 'AddCardResistance' && action.element !== null) {
      if (!conditional && !everyTurn) {
        stats.addAmount('resistances', action.element, value);
        quantified = true;
      }
    } else if (action.effect === 'AddOppCardResistance' && action.element !== null && /allie/.test(text)) {
      if (!conditional && !everyTurn) {
        stats.addAmount('allyResistances', action.element, value);
        quantified = true;
      }
    } else if (BONUS_EFFECT.test(action.effect) && !conditional) {
      for (const [element, share] of Object.entries(elementShares(action, card, text, context))) {
        stats.addAmount(everyTurn ? 'passiveBonusPerTurn' : 'startingBonus', element, value * share);
        quantified = true;
      }
    } else if (!conditional) {
      const boosts = toBoosts(action, value, text, 0);
      (everyTurn ? stats.boostsPerTurn : stats.startingBoosts).push(...boosts);
      quantified ||= boosts.length > 0;
    }
  }
  if ((conditional || everyTurn) && !quantified && talent.actions.some((action) => action.effect !== NO_EFFECT)) {
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
function elementShares(action: CardAction, card: CardData, text: string, context: StatsContext): ElementAmounts {
  if (action.element !== null) {
    return { [action.element]: 1 };
  }
  if (action.effect === CARD_ELEMENT_DAMAGE) {
    return { [card.element]: 1 };
  }
  const elements = context.baseElements;
  if (EVERY_ELEMENT.test(text)) {
    return Object.fromEntries(elements.map((element) => [element, 1]));
  }
  if (/Random/.test(action.effect) || RANDOM_ELEMENT.test(text)) {
    return Object.fromEntries(elements.map((element) => [element, 1 / elements.length]));
  }
  return {};
}

type AmountField = 'resistances' | 'allyResistances' | 'passiveBonusPerTurn' | 'startingBonus';

class Contribution {
  readonly abilities: AbilityModel[] = [];
  readonly startingBoosts: Boost[] = [];
  readonly boostsPerTurn: Boost[] = [];
  private readonly amounts: Record<AmountField, Record<string, number>> = {
    resistances: {},
    allyResistances: {},
    passiveBonusPerTurn: {},
    startingBonus: {},
  };
  private readonly notes = new Map<string, UnquantifiedEffect>();

  addAmount(field: AmountField, element: string, value: number): void {
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
      abilities: this.abilities,
      passiveBonusPerTurn: round(this.amounts.passiveBonusPerTurn),
      startingBonus: round(this.amounts.startingBonus),
      startingBoosts: this.startingBoosts,
      boostsPerTurn: this.boostsPerTurn,
      unquantified: [...this.notes.values()],
    };
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
