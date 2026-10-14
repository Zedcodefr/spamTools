import { DomainError } from '@spamtools/shared-kernel';
import { DECK_SIZE, type DeckSlot } from './Deck.js';
import {
  analyzeDeck,
  NO_CONTRIBUTION,
  type DeckAnalysis,
  type DeckCardStats,
  type StatContribution,
} from './DeckAnalysis.js';

/**
 * Recherche des meilleurs decks : complète une sélection de départ (cartes fixées) pour maximiser
 * un objectif, en simulant chaque candidat avec analyzeDeck. L'espace (≈ 10 millions de decks ×
 * talents × DPS) est trop grand pour tout essayer : construction carte par carte en gardant les
 * meilleurs candidats (faisceau), puis amélioration par remplacements successifs, dans un budget de temps.
 */

/** Une carte candidate : son modèle et celui de chacun de ses talents. */
export interface CandidateCard {
  readonly cardId: string;
  readonly cardName: string;
  readonly base: StatContribution;
  readonly bonusFactor: number;
  readonly talents: readonly { readonly slot: number; readonly name: string; readonly contribution: StatContribution }[];
}

/**
 * Objectif : dégâts^(1 − healWeight) × soins^healWeight. healWeight = 0 : dégâts seuls ; 1 : soins seuls ;
 * entre les deux, un compromis indépendant des ordres de grandeur, qui exige les deux.
 */
export interface SearchObjective {
  readonly damage: 'total' | 'single';
  readonly healWeight: number;
}

export interface SearchOptions {
  readonly turns: number;
  /** Cartes à garder ; un talent nul laisse la recherche le choisir. */
  readonly locked: readonly DeckSlot[];
  readonly excludedCardIds?: readonly string[];
  readonly count?: number;
  /** Budget de temps indicatif ; la recherche rend le meilleur trouvé à son terme. */
  readonly budgetMs?: number;
  readonly now?: () => number;
}

export interface DeckSuggestion {
  readonly slots: readonly DeckSlot[];
  readonly dpsCardId: string | null;
  readonly score: number;
  readonly totalDamagePerTurn: number;
  readonly totalSingleTargetDamagePerTurn: number;
  readonly totalHealPerTurn: number;
}

export interface SearchResult {
  readonly suggestions: readonly DeckSuggestion[];
  readonly simulations: number;
  readonly complete: boolean;
}

const BEAM_WIDTH = 12;
const LOCAL_SEARCH_STARTS = 5;
const DEFAULT_COUNT = 3;
const DEFAULT_BUDGET_MS = 4000;

/** Une option : une carte et un talent (ou aucun). */
interface Option {
  readonly card: CandidateCard;
  readonly slot: number | null;
  readonly stats: DeckCardStats;
  readonly targetsDps: boolean;
}

export function objectiveScore(analysis: DeckAnalysis, objective: SearchObjective): number {
  const damage = objective.damage === 'total' ? analysis.totalDamagePerTurn : analysis.totalSingleTargetDamagePerTurn;
  const weight = Math.min(1, Math.max(0, objective.healWeight));
  if (weight === 0) {
    return damage;
  }
  if (weight === 1) {
    return analysis.totalHealPerTurn;
  }
  return damage ** (1 - weight) * analysis.totalHealPerTurn ** weight;
}

export function searchDecks(
  candidates: readonly CandidateCard[],
  objective: SearchObjective,
  options: SearchOptions,
): SearchResult {
  const now = options.now ?? (() => Date.now());
  const deadline = now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const excluded = new Set(options.excludedCardIds ?? []);
  const byId = new Map(candidates.map((card) => [card.cardId, card]));
  if (options.locked.length > DECK_SIZE) {
    throw new DomainError(`Un deck compte au plus ${DECK_SIZE} cartes`);
  }

  // Cartes fixées : leur talent est gardé s'il est choisi, sinon tous leurs talents sont possibles.
  const lockedChoices = options.locked.map((slot) => {
    const card = byId.get(slot.cardId);
    if (card === undefined) {
      throw new DomainError(`Carte inconnue : ${slot.cardId}`);
    }
    if (slot.talentSlot === null) {
      return optionsOf(card);
    }
    // Talent choisi par l'utilisateur : gardé tel quel, même s'il équivaut à « aucun » en chiffres.
    const talent = card.talents.find((candidate) => candidate.slot === slot.talentSlot);
    if (talent === undefined) {
      throw new DomainError(`Talent ${slot.talentSlot} introuvable pour la carte "${card.cardName}"`);
    }
    return [option(card, talent.slot, talent.name, talent.contribution)];
  });
  const lockedIds = new Set(options.locked.map((slot) => slot.cardId));
  const pool = candidates
    .filter((card) => !lockedIds.has(card.cardId) && !excluded.has(card.cardId))
    .flatMap(optionsOf);

  let simulations = 0;
  let complete = true;
  const cache = new Map<string, Scored>();
  const evaluate = (deck: readonly Option[]): Scored => {
    const key = keyOf(deck);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    // Le DPS ne compte que si une carte lance des renforts ciblés : sinon une seule simulation.
    const dpsChoices = deck.some((option) => option.targetsDps)
      ? [null, ...deck.map((option) => option.card.cardId)]
      : [null];
    let best: Scored = { deck, dpsCardId: null, score: -1, analysis: undefined };
    for (const dpsCardId of dpsChoices) {
      simulations++;
      const analysis = analyzeDeck(
        deck.map((option) => option.stats),
        { turns: options.turns, dpsCardId },
      );
      const score = objectiveScore(analysis, objective);
      if (score > best.score) {
        best = { deck, dpsCardId, score, analysis };
      }
    }
    cache.set(key, best);
    return best;
  };
  const outOfTime = () => {
    if (now() > deadline) {
      complete = false;
      return true;
    }
    return false;
  };

  // 1. Faisceau : on part des combinaisons possibles des cartes fixées, puis on ajoute une carte à la fois.
  let beam: Option[][] = combinations(lockedChoices);
  while ((beam[0]?.length ?? DECK_SIZE) < DECK_SIZE && !outOfTime()) {
    const next = new Map<string, Scored>();
    for (const deck of beam) {
      for (const option of pool) {
        if (deck.some((member) => member.card.cardId === option.card.cardId)) {
          continue;
        }
        const scored = evaluate([...deck, option]);
        next.set(keyOf(scored.deck), scored);
      }
      if (outOfTime()) {
        break;
      }
    }
    beam = [...next.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, BEAM_WIDTH)
      .map((scored) => [...scored.deck]);
  }

  // 2. Amélioration : remplacer une carte libre (ou le talent d'une carte fixée sans talent choisi).
  const lockedCount = options.locked.length;
  const targetSize = Math.min(DECK_SIZE, lockedCount + new Set(pool.map((option) => option.card.cardId)).size);
  for (const start of beam.slice(0, LOCAL_SEARCH_STARTS)) {
    let current = evaluate(start);
    for (let improved = true; improved && !outOfTime(); ) {
      improved = false;
      for (let position = 0; position < current.deck.length; position++) {
        const choices = position < lockedCount ? (lockedChoices[position] ?? []) : pool;
        for (const option of choices) {
          const deck = current.deck.map((member, index) => (index === position ? option : member));
          if (new Set(deck.map((member) => member.card.cardId)).size !== deck.length) {
            continue;
          }
          const scored = evaluate(deck);
          if (scored.score > current.score + 1e-9) {
            current = scored;
            improved = true;
          }
        }
        if (outOfTime()) {
          break;
        }
      }
    }
  }

  // 3. Meilleurs decks distincts (par cartes, pas par talents équivalents).
  const seen = new Set<string>();
  const suggestions: DeckSuggestion[] = [];
  for (const scored of [...cache.values()].sort((a, b) => b.score - a.score)) {
    const cardsKey = scored.deck.map((option) => option.card.cardId).sort().join(',');
    if (scored.deck.length !== targetSize || seen.has(cardsKey)) {
      continue;
    }
    seen.add(cardsKey);
    suggestions.push(toSuggestion(scored));
    if (suggestions.length >= (options.count ?? DEFAULT_COUNT)) {
      break;
    }
  }
  if (suggestions.length === 0 && beam[0] !== undefined) {
    suggestions.push(toSuggestion(evaluate(beam[0])));
  }
  return { suggestions, simulations, complete };
}

interface Scored {
  readonly deck: readonly Option[];
  readonly dpsCardId: string | null;
  readonly score: number;
  readonly analysis: DeckAnalysis | undefined;
}

function toSuggestion(scored: Scored): DeckSuggestion {
  return {
    slots: scored.deck.map((option) => ({ cardId: option.card.cardId, talentSlot: option.slot })),
    dpsCardId: scored.dpsCardId,
    score: round(scored.score),
    totalDamagePerTurn: scored.analysis?.totalDamagePerTurn ?? 0,
    totalSingleTargetDamagePerTurn: scored.analysis?.totalSingleTargetDamagePerTurn ?? 0,
    totalHealPerTurn: scored.analysis?.totalHealPerTurn ?? 0,
  };
}

/** Options d'une carte : sans talent, puis chaque talent qui change les chiffres (les autres équivalent à « aucun »). */
function optionsOf(card: CandidateCard): Option[] {
  const seen = new Set<string>([fingerprint(NO_CONTRIBUTION)]);
  const options = [option(card, null, null, NO_CONTRIBUTION)];
  for (const talent of card.talents) {
    const key = fingerprint(talent.contribution);
    if (!seen.has(key)) {
      seen.add(key);
      options.push(option(card, talent.slot, talent.name, talent.contribution));
    }
  }
  return options;
}

function option(card: CandidateCard, slot: number | null, talentName: string | null, talent: StatContribution): Option {
  const boosts = [card.base, talent].flatMap((contribution) => [
    ...contribution.abilities.flatMap((ability) => ability.boosts),
    ...contribution.startingBoosts,
    ...contribution.boostsPerTurn,
  ]);
  return {
    card,
    slot,
    stats: {
      cardId: card.cardId,
      cardName: card.cardName,
      talentName,
      base: card.base,
      talent,
      bonusFactor: card.bonusFactor,
    },
    targetsDps: boosts.some((boost) => boost.target === 'dps'),
  };
}

/** Empreinte chiffrée d'un apport (sans les effets non chiffrés, qui ne changent pas les résultats). */
function fingerprint(contribution: StatContribution): string {
  const { unquantified: _ignored, ...numbers } = contribution;
  return JSON.stringify(numbers);
}

function keyOf(deck: readonly Option[]): string {
  return deck
    .map((option) => `${option.card.cardId}:${option.slot ?? '-'}`)
    .sort()
    .join(',');
}

/** Toutes les combinaisons d'options des cartes fixées (au plus 4 × 4). */
function combinations(choices: readonly (readonly Option[])[]): Option[][] {
  return choices.reduce<Option[][]>(
    (decks, options) => decks.flatMap((deck) => options.map((option) => [...deck, option])),
    [[]],
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
