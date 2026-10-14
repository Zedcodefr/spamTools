import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import { analyzeDeck, type DeckCardStats, type StatContribution } from './DeckAnalysis.js';
import { Deck } from './Deck.js';

const NOW = new Date('2026-10-14T12:00:00Z');
const content = (slots: { cardId: string; talentSlot: number }[]) => ({ name: 'Feu', version: '1.21', language: 'fr', slots });

describe('Deck', () => {
  it('accepte jusqu’à 4 cartes distinctes avec un talent chacune', () => {
    const deck = Deck.create(content([1, 2, 3, 4].map((n) => ({ cardId: `c${n}`, talentSlot: 1 }))), NOW);
    assert.equal(deck.slots.length, 4);
  });

  it('refuse plus de 4 cartes, un doublon, un talent invalide ou un nom vide', () => {
    assert.throws(() => Deck.create(content([1, 2, 3, 4, 5].map((n) => ({ cardId: `c${n}`, talentSlot: 1 }))), NOW), DomainError);
    assert.throws(() => Deck.create(content([{ cardId: 'c1', talentSlot: 1 }, { cardId: 'c1', talentSlot: 2 }]), NOW), /qu’une fois/);
    assert.throws(() => Deck.create(content([{ cardId: 'c1', talentSlot: 0 }]), NOW), DomainError);
    assert.throws(() => Deck.create({ ...content([]), name: '  ' }, NOW), /nom/);
  });

  it('met à jour son contenu et sa date de modification', () => {
    const deck = Deck.create(content([]), NOW);
    const later = new Date('2026-10-15T12:00:00Z');
    deck.update({ ...content([{ cardId: 'c1', talentSlot: 2 }]), name: 'Eau' }, later);
    assert.equal(deck.name, 'Eau');
    assert.equal(deck.updatedAt, later);
    assert.equal(deck.createdAt, NOW);
  });
});

const empty: StatContribution = {
  resistances: {}, allyResistances: {}, damagePerTurn: {}, healPerTurn: {}, generatedPerTurn: {}, consumedPerTurn: {},
  startingBonus: {}, unquantified: [],
};

const cardStats = (
  cardId: string,
  base: Partial<StatContribution>,
  talent: Partial<StatContribution> = {},
  bonusFactor = 1,
): DeckCardStats => ({
  cardId, cardName: cardId, talentName: `${cardId}-talent`, base: { ...empty, ...base }, talent: { ...empty, ...talent }, bonusFactor,
});

describe('analyzeDeck', () => {
  it('moyenne les résistances, talents et bonus d’équipe compris, et désigne les faiblesses', () => {
    const analysis = analyzeDeck([
      cardStats('a', { resistances: { fire: 10, water: 0 } }, { resistances: { water: 20 } }),
      cardStats('b', { resistances: { fire: 30, water: -10 } }, { allyResistances: { fire: 10, water: 10 } }),
    ]);
    // a : feu 10 + 10, eau 20 + 10 ; b : feu 30 + 10, eau -10 + 10
    assert.deepEqual(analysis.averageResistances, { fire: 30, water: 15 });
    assert.deepEqual(analysis.weaknesses, ['water']);
  });

  it('additionne dégâts, soins et éléments par tour', () => {
    const analysis = analyzeDeck([
      cardStats('a', { damagePerTurn: { fire: 10 }, generatedPerTurn: { fire: 1 }, unquantified: [{ source: 'x', reason: 'y' }] }),
      cardStats('b', { damagePerTurn: { fire: 5, water: 4 }, healPerTurn: { light: 6 }, consumedPerTurn: { fire: 0.5 } }),
    ]);
    assert.deepEqual(analysis.damagePerTurn, { fire: 15, water: 4 });
    assert.equal(analysis.totalDamagePerTurn, 19);
    assert.deepEqual(analysis.healPerTurn, { light: 6 });
    assert.deepEqual(analysis.netPerTurn, { fire: 0.5 });
    assert.deepEqual(analysis.unquantified, [{ cardName: 'a', source: 'x', reason: 'y' }]);
  });

  it('cumule les bonus tour après tour : +10 % de dégâts et soins par point', () => {
    const analysis = analyzeDeck(
      [cardStats('a', { damagePerTurn: { fire: 10 }, healPerTurn: { fire: 10 }, generatedPerTurn: { fire: 2 } }, { startingBonus: { fire: 1 } })],
      3,
    );
    // Stock de feu : 1 au tour 1, puis +2 par tour -> 1, 3, 5.
    assert.deepEqual(analysis.turns.map((turn) => turn.bonusStock['fire']), [1, 3, 5]);
    assert.deepEqual(analysis.turns.map((turn) => turn.totalDamage), [11, 13, 15]);
    assert.deepEqual(analysis.turns.map((turn) => turn.totalHeal), [11, 13, 15]);
    assert.equal(analysis.averageTotalDamagePerTurn, 13);
  });

  it('retire les éléments consommés du stock, sans descendre sous zéro', () => {
    const analysis = analyzeDeck(
      [cardStats('a', { damagePerTurn: { fire: 10 }, generatedPerTurn: { fire: 1 }, consumedPerTurn: { fire: 3 } }, { startingBonus: { fire: 3 } })],
      4,
    );
    assert.deepEqual(analysis.turns.map((turn) => turn.bonusStock['fire']), [3, 1, 0, 0]);
  });

  it('double l’effet des bonus pour une carte avec Multiplicateur', () => {
    const analysis = analyzeDeck(
      [
        cardStats('a', { damagePerTurn: { fire: 10 } }, { startingBonus: { fire: 5 } }, 2),
        cardStats('b', { damagePerTurn: { fire: 10 } }),
      ],
      1,
    );
    assert.equal(analysis.turns[0]?.totalDamage, 10 * 2 + 10 * 1.5);
  });
});
