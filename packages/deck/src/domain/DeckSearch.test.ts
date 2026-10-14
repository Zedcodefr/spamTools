import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeDeck, NO_CONTRIBUTION, type AbilityModel, type Boost, type StatContribution } from './DeckAnalysis.js';
import { objectiveScore, searchDecks, type CandidateCard, type SearchObjective } from './DeckSearch.js';

const line = (value: number, element: string) => ({
  value, elements: { [element]: 1 }, targets: 1, singleTarget: 1, weight: 1, onCritOnly: false,
});

const ability = (overrides: Partial<AbilityModel>): AbilityModel => ({
  name: 'Capacité', cooldown: 1, echoChance: 0, period: 1, precision: 100, critChance: 0, critMultiplier: 2, damage: [], heal: [],
  bonus: [], cost: {}, growth: { damage: 0, heal: 0, bonus: 0 }, boosts: [], ...overrides,
});

const contribution = (overrides: Partial<StatContribution>): StatContribution => ({ ...NO_CONTRIBUTION, ...overrides });

const card = (cardId: string, base: Partial<StatContribution>, talents: CandidateCard['talents'] = []): CandidateCard => ({
  cardId, cardName: cardId, base: contribution(base), bonusFactor: 1, talents,
});

const dpsBoost: Boost = { stat: 'baseDamage', amount: 20, target: 'dps', chance: 1 };

/** Petit catalogue avec des synergies : bonus de feu, renfort ciblé, soigneur, talent utile ou neutre. */
const candidates: CandidateCard[] = [
  card('fire-attacker', { abilities: [ability({ damage: [line(20, 'fire')] })] }),
  card('water-attacker', { abilities: [ability({ damage: [line(28, 'water')] })] }),
  card('fire-bonus', { abilities: [ability({ bonus: [line(3, 'fire')] })] }, [
    { slot: 1, name: 'Neutre', contribution: contribution({ unquantified: [{ source: 'x', reason: 'y' }] }) },
    { slot: 2, name: 'Feu', contribution: contribution({ passiveBonusPerTurn: { fire: 2 } }) },
  ]),
  card('booster', { abilities: [ability({ boosts: [dpsBoost] })] }),
  card('healer', { abilities: [ability({ heal: [line(40, 'light')], damage: [line(2, 'light')] })] }),
  card('weak', { abilities: [ability({ damage: [line(3, 'earth')] })] }),
];

/** Optimum exact par force brute : toutes les cartes × talents × DPS. */
function bruteForce(objective: SearchObjective, locked: string[] = []): number {
  const options = candidates.flatMap((candidate) =>
    [null, ...candidate.talents.map((talent) => talent.slot)].map((slot) => ({ candidate, slot })),
  );
  let best = -1;
  const visit = (deck: typeof options, start: number) => {
    if (deck.length === 4) {
      if (!locked.every((id) => deck.some((option) => option.candidate.cardId === id))) return;
      const stats = deck.map(({ candidate, slot }) => ({
        cardId: candidate.cardId, cardName: candidate.cardName, talentName: null, base: candidate.base, bonusFactor: 1,
        talent: slot === null ? NO_CONTRIBUTION : (candidate.talents.find((t) => t.slot === slot)?.contribution ?? NO_CONTRIBUTION),
      }));
      for (const dps of [null, ...deck.map((option) => option.candidate.cardId)]) {
        best = Math.max(best, objectiveScore(analyzeDeck(stats, { turns: 5, dpsCardId: dps }), objective));
      }
      return;
    }
    for (let index = start; index < options.length; index++) {
      const option = options[index]!;
      if (!deck.some((member) => member.candidate.cardId === option.candidate.cardId)) visit([...deck, option], index + 1);
    }
  };
  visit([], 0);
  return Math.round(best * 100) / 100;
}

describe('searchDecks', () => {
  it('trouve l’optimum des dégâts totaux (comparé à la force brute)', () => {
    const objective: SearchObjective = { damage: 'total', healWeight: 0 };
    const [best] = searchDecks(candidates, objective, { turns: 5, locked: [] }).suggestions;
    assert.equal(best?.score, bruteForce(objective));
    assert.ok(best?.slots.some((slot) => slot.cardId === 'fire-bonus' && slot.talentSlot === 2), 'talent utile choisi');
  });

  it('choisit le DPS qui reçoit les renforts ciblés', () => {
    const [best] = searchDecks(candidates, { damage: 'total', healWeight: 0 }, { turns: 5, locked: [] }).suggestions;
    assert.ok(best?.slots.some((slot) => slot.cardId === 'booster'));
    assert.notEqual(best?.dpsCardId, null);
  });

  it('complète une sélection de départ et garde le talent choisi', () => {
    const objective: SearchObjective = { damage: 'total', healWeight: 0 };
    const [best] = searchDecks(candidates, objective, {
      turns: 5,
      locked: [{ cardId: 'weak', talentSlot: null }, { cardId: 'fire-bonus', talentSlot: 1 }],
    }).suggestions;
    assert.deepEqual(best?.slots.slice(0, 2), [
      { cardId: 'weak', talentSlot: null },
      { cardId: 'fire-bonus', talentSlot: 1 },
    ]);
    assert.equal(best?.slots.length, 4);
  });

  it('cherche les soins, ou un compromis qui garde les deux', () => {
    const heal = searchDecks(candidates, { damage: 'total', healWeight: 1 }, { turns: 5, locked: [] }).suggestions[0];
    assert.ok(heal?.slots.some((slot) => slot.cardId === 'healer'));
    const balanced: SearchObjective = { damage: 'total', healWeight: 0.5 };
    const [best] = searchDecks(candidates, balanced, { turns: 5, locked: [] }).suggestions;
    assert.equal(best?.score, bruteForce(balanced));
    assert.ok((best?.totalHealPerTurn ?? 0) > 0 && (best?.totalDamagePerTurn ?? 0) > 0);
  });

  it('écarte les cartes exclues et propose des decks distincts', () => {
    const result = searchDecks(candidates, { damage: 'total', healWeight: 0 }, {
      turns: 5, locked: [], excludedCardIds: ['booster'], count: 3,
    });
    assert.ok(result.suggestions.every((suggestion) => suggestion.slots.every((slot) => slot.cardId !== 'booster')));
    const keys = result.suggestions.map((suggestion) => suggestion.slots.map((slot) => slot.cardId).sort().join());
    assert.equal(new Set(keys).size, keys.length);
  });
});
