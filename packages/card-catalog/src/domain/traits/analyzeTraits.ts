import type { Ability, CardAction, CardData } from '../Card.js';
import type { CardElement, Keyword } from '../References.js';
import type { CardTraits, CatalogTraits, SpecialAbility, TraitIcon } from './CardTraits.js';
import { computeCardStats, type StatsContext } from './computeCardStats.js';
import {
  ANALYSIS_VERSION,
  DEFAULT_CATEGORY,
  KNOWN_ABILITIES,
  MECHANIC_KEYWORDS,
  PUNCHING_BAG,
  RANDOM_ELEMENT_ACTION,
  RANDOM_ELEMENT_LINE,
  RANDOM_HEART,
  TEXT_PATTERNS,
  TRAIT_CATEGORIES,
  UNNAMED_ACTIONS,
} from './TraitTaxonomy.js';

/** Bonus élémentaire accordé au joueur (« Bonus Feu (+1) »), avec ses variantes. */
const BONUS_EFFECT = /^AddAllPlayerAttack/;
/** Dégâts infligés dans l'élément de la carte elle-même. */
const CARD_ELEMENT_DAMAGE = 'DamageWithCardElement';
const KEYWORD_REFERENCE = /\{kw:([^}]+)\}/g;
const CHOICE_REFERENCE = '{kw:choice}';
/** Mots-clés du jeu qui désignent un passif ou une compétence spéciale. */
const PASSIVE_KEYWORD_TYPES = new Set(['passive', 'active']);
/** « Insensible aux Disparitions » ne fait pas de la carte une carte à Disparition. */
const IMMUNITY_MENTION = /insensibles? aux? [\p{L}']+/gu;

export interface TraitAnalysisInput {
  readonly cards: readonly CardData[];
  readonly elements: readonly CardElement[];
  readonly keywords: readonly Keyword[];
}

/**
 * Calcule les caractéristiques de toutes les cartes d'un catalogue :
 * éléments de frappe, de bonus et de soin, capacités particulières et leurs catégories.
 */
export function analyzeTraits({ cards, elements, keywords }: TraitAnalysisInput): CatalogTraits {
  const vocabulary = buildVocabulary(cards, keywords);
  const statsContext = buildStatsContext(elements, vocabulary);
  const byCard: Record<string, CardTraits> = {};
  for (const card of cards) {
    byCard[card.id] = { ...analyzeCard(card, keywords, vocabulary), stats: computeCardStats(card, statsContext) };
  }

  const presentAbilities = new Set(Object.values(byCard).flatMap((traits) => traits.specialAbilities));
  const specialAbilities = [...vocabulary.byKey.values()]
    .filter((special) => presentAbilities.has(special.key))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const presentCategories = new Set(specialAbilities.map((special) => special.category));

  return {
    analysisVersion: ANALYSIS_VERSION,
    categories: TRAIT_CATEGORIES.filter((category) => presentCategories.has(category.id)),
    specialAbilities,
    byCard,
  };
}

/** Nom normalisé d'une capacité : sans accents, sans casse. */
export function specialAbilityKey(label: string): string {
  return normalize(label).trim();
}

interface Vocabulary {
  readonly byKey: Map<string, SpecialAbility>;
  /** Élément des passifs élémentaires (Cœur de feu -> fire), d'après les tox qui le précisent. */
  readonly elementByKey: Map<string, string>;
  /** Éléments de base (ceux des résistances) : les couvrir tous rend une capacité multiélément. */
  readonly baseElements: ReadonlySet<string>;
  /** Mots-clés passifs/actifs indexés par identifiant sans préfixe ni rareté. */
  readonly passiveKeywordsByBaseId: Map<string, Keyword>;
  /** Détection d'une capacité citée dans un texte d'effet, en mot entier. */
  readonly mentions: readonly { readonly key: string; readonly pattern: RegExp }[];
}

function buildVocabulary(cards: readonly CardData[], keywords: readonly Keyword[]): Vocabulary {
  const byKey = new Map<string, SpecialAbility>();
  const add = (label: string, description: string | null, gameIcon: string | null) => {
    const key = specialAbilityKey(label);
    const existing = byKey.get(key);
    if (existing !== undefined) {
      // Une icône officielle trouvée plus tard (autre carte, mot-clé) remplace un symbole générique.
      if (gameIcon !== null && existing.icon.type === 'symbol') {
        byKey.set(key, { ...existing, icon: { type: 'asset', path: gameIcon } });
      }
      return;
    }
    const known = KNOWN_ABILITIES[label] ?? findKnownAbility(key);
    const category = known?.category ?? DEFAULT_CATEGORY;
    const icon: TraitIcon =
      gameIcon !== null
        ? { type: 'asset', path: gameIcon }
        : { type: 'symbol', name: known?.symbol ?? categorySymbol(category) };
    byKey.set(key, { key, label, category, description, icon });
  };

  // Les tox portés par les cartes sont la source la plus complète des passifs (et de leurs icônes).
  for (const skill of cards.flatMap((card) => card.skills)) {
    add(skill.name, skill.effect, skill.icon);
  }
  for (const keyword of keywords) {
    if (PASSIVE_KEYWORD_TYPES.has(keyword.tooltip) || MECHANIC_KEYWORDS.has(keyword.id)) {
      add(keyword.title, keyword.description, keyword.icon);
    }
  }
  // Capacités sans nom dans les données, et capacités dérivées.
  for (const card of cards) {
    for (const entry of [...card.abilities, ...card.talents]) {
      for (const action of entry.actions) {
        const label = UNNAMED_ACTIONS[action.effect];
        if (label !== undefined) {
          add(label, entry.effect, null);
        }
      }
    }
  }
  for (const { label } of TEXT_PATTERNS) {
    add(label, null, null);
  }
  add('Attaque multiple', 'Une même capacité frappe plusieurs fois', null);

  const passiveKeywordsByBaseId = new Map(
    keywords.filter((keyword) => PASSIVE_KEYWORD_TYPES.has(keyword.tooltip)).map((keyword) => [baseId(keyword.id), keyword]),
  );
  const mentions = [...byKey.values()].map((special) => ({
    key: special.key,
    pattern: new RegExp(`(?:^|[^\\p{L}])${escapeRegExp(special.key)}(?![\\p{L}])`, 'u'),
  }));

  const elementByKey = new Map(
    cards
      .flatMap((card) => card.skills)
      .flatMap((skill) => (skill.element === null ? [] : [[specialAbilityKey(skill.name), skill.element] as const])),
  );
  const baseElements = new Set(cards.flatMap((card) => Object.keys(card.resistances)));

  return { byKey, elementByKey, baseElements, passiveKeywordsByBaseId, mentions };
}

function buildStatsContext(elements: readonly CardElement[], vocabulary: Vocabulary): StatsContext {
  return {
    baseElements: [...vocabulary.baseElements],
    elementIdByName: new Map(elements.map((element) => [normalize(element.name), element.id])),
    grantedPassive: (talent) => {
      const keyword =
        talent.grantsSkill === null ? undefined : vocabulary.passiveKeywordsByBaseId.get(baseId(talent.grantsSkill));
      return keyword === undefined
        ? undefined
        : { key: specialAbilityKey(keyword.title), label: keyword.title, description: keyword.description };
    },
    passiveElement: (key) => vocabulary.elementByKey.get(key),
    keyOf: specialAbilityKey,
  };
}

function analyzeCard(card: CardData, keywords: readonly Keyword[], vocabulary: Vocabulary): Omit<CardTraits, 'stats'> {
  const abilityActions = card.abilities.flatMap((ability) => ability.actions);
  const keywordsById = new Map(keywords.map((keyword) => [keyword.id, keyword]));

  const strikeElements = elementsOf(
    abilityActions.filter((action) => action.kind === 'damage'),
    card,
  );
  const healElements = elementsOf(
    abilityActions.filter((action) => action.kind === 'heal'),
    card,
  );
  const bonusElements = new Set(
    abilityActions.flatMap((action) =>
      BONUS_EFFECT.test(action.effect) && action.element !== null ? [action.element] : [],
    ),
  );
  // Passifs naturels (tox de la carte ou donné par un talent) : Cœurs dans leur élément,
  // Sac de frappe dans celui de la carte.
  const naturalPassives = naturalPassivesOf(card, vocabulary);
  for (const key of naturalPassives) {
    const element = key === specialAbilityKey(PUNCHING_BAG) ? card.element : vocabulary.elementByKey.get(key);
    if (element !== undefined) {
      bonusElements.add(element);
    }
  }
  const multiElement =
    naturalPassives.has(specialAbilityKey(RANDOM_HEART)) ||
    card.abilities.some((ability) => isMultiElement(ability, vocabulary.baseElements));

  const specialAbilities = new Set<string>();
  const addIfKnown = (label: string) => {
    const key = specialAbilityKey(label);
    if (vocabulary.byKey.has(key)) {
      specialAbilities.add(key);
    }
  };
  const entries = [...card.abilities, ...card.skills, ...card.talents];

  // Tox portés par la carte ou accordés par un talent.
  naturalPassives.forEach((key) => specialAbilities.add(key));
  // Mots-clés balisés dans les textes d'effet.
  for (const entry of entries) {
    for (const [, id] of entry.effectRich.matchAll(KEYWORD_REFERENCE)) {
      const keyword = id === undefined ? undefined : keywordsById.get(id);
      if (keyword !== undefined) {
        addIfKnown(keyword.title);
      }
    }
  }
  // Capacités sans nom, reconnues à leur code d'action.
  for (const action of [...abilityActions, ...card.talents.flatMap((talent) => talent.actions)]) {
    const label = UNNAMED_ACTIONS[action.effect];
    if (label !== undefined) {
      addIfKnown(label);
    }
  }
  // Capacités citées en toutes lettres (« Applique Gel », « le passif "Bomba" »...) ou reconnues à une ligne de texte.
  const texts = entries.map((entry) => normalize(entry.effect).replace(IMMUNITY_MENTION, ' '));
  for (const { key, pattern } of vocabulary.mentions) {
    if (texts.some((text) => pattern.test(text))) {
      specialAbilities.add(key);
    }
  }
  for (const { label, pattern } of TEXT_PATTERNS) {
    if (texts.some((text) => pattern.test(text))) {
      addIfKnown(label);
    }
  }
  if (card.abilities.some(isMultiHit)) {
    addIfKnown('Attaque multiple');
  }

  const categories = new Set(
    [...specialAbilities].flatMap((key) => {
      const special = vocabulary.byKey.get(key);
      return special === undefined ? [] : [special.category];
    }),
  );

  return {
    strikeElements: [...strikeElements].sort(),
    bonusElements: [...bonusElements].sort(),
    healElements: [...healElements].sort(),
    multiElement,
    specialAbilities: [...specialAbilities].sort(),
    categories: [...categories].sort(),
  };
}

/** Tox de la carte et passifs accordés par ses talents (par leur tox ou leur code d'action). */
function naturalPassivesOf(card: CardData, vocabulary: Vocabulary): Set<string> {
  const labels = card.skills.map((skill) => skill.name);
  for (const talent of card.talents) {
    const granted =
      talent.grantsSkill === null ? undefined : vocabulary.passiveKeywordsByBaseId.get(baseId(talent.grantsSkill));
    if (granted !== undefined) {
      labels.push(granted.title);
    }
    for (const action of talent.actions) {
      const unnamed = UNNAMED_ACTIONS[action.effect];
      if (unnamed !== undefined) {
        labels.push(unnamed);
      }
    }
  }
  return new Set(labels.map(specialAbilityKey).filter((key) => vocabulary.byKey.has(key)));
}

/** Capacité dans un élément aléatoire, ou dont les dégâts, soins ou bonus couvrent tous les éléments. */
function isMultiElement(ability: Ability, baseElements: ReadonlySet<string>): boolean {
  if (ability.actions.some((action) => RANDOM_ELEMENT_ACTION.test(action.effect))) {
    return true;
  }
  if (normalize(ability.effect).split('\n').some((line) => RANDOM_ELEMENT_LINE.test(line.trim()))) {
    return true;
  }
  const covered = new Set(
    ability.actions
      .filter((action) => action.kind === 'damage' || action.kind === 'heal' || BONUS_EFFECT.test(action.effect))
      .flatMap((action) => (action.element === null ? [] : [action.element])),
  );
  return baseElements.size > 0 && [...baseElements].every((element) => covered.has(element));
}

/**
 * Plusieurs coups successifs dans une même capacité : les actions de dégâts portent des
 * numéros d'enchaînement (`chain`) différents. Un coup dans plusieurs éléments à la fois
 * n'en est pas un, ni les alternatives d'une capacité à « Choix ».
 */
function isMultiHit(ability: Ability): boolean {
  if (ability.effectRich.includes(CHOICE_REFERENCE)) {
    return false;
  }
  const hits = new Set(ability.actions.filter((action) => action.kind === 'damage').map((action) => action.chain));
  return hits.size >= 2;
}

function elementsOf(actions: readonly CardAction[], card: CardData): Set<string> {
  return new Set(
    actions.flatMap((action) => {
      if (action.element !== null) {
        return [action.element];
      }
      return action.effect === CARD_ELEMENT_DAMAGE ? [card.element] : [];
    }),
  );
}

function findKnownAbility(key: string) {
  const entry = Object.entries(KNOWN_ABILITIES).find(([label]) => specialAbilityKey(label) === key);
  return entry?.[1];
}

function categorySymbol(categoryId: string): string {
  const icon = TRAIT_CATEGORIES.find((category) => category.id === categoryId)?.icon;
  return icon?.type === 'symbol' ? icon.name : 'Sparkles';
}

/**
 * Identifiant sans préfixe ni rareté : "tox.Disparition", "Disparition_L" -> "Disparition" ;
 * "talent.TBrut", "Brut_R" -> "Brut".
 */
function baseId(id: string): string {
  return id
    .replace(/^(tox|ability)\./, '')
    .replace(/^talent\.T(?=[A-Z])/, '')
    .replace(/_[CRELD]$/, '');
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
