import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import { analyzeDeck, type AbilityModel, type Boost, type DeckCardStats, type StatContribution } from './DeckAnalysis.js';
import { Deck } from './Deck.js';

const NOW = new Date('2026-10-14T12:00:00Z');
const content = (slots: { cardId: string; talentSlot: number | null }[]) => ({
  name: 'Feu',
  version: '1.21',
  language: 'fr',
  slots,
});

describe('Deck', () => {
  it('accepte jusqu’à 4 cartes distinctes avec un talent chacune', () => {
    const deck = Deck.create(content([1, 2, 3, 4].map((n) => ({ cardId: `c${n}`, talentSlot: 1 }))), NOW);
    assert.equal(deck.slots.length, 4);
  });

  it('accepte une carte sans talent', () => {
    assert.equal(Deck.create(content([{ cardId: 'c1', talentSlot: null }]), NOW).slots[0]?.talentSlot, null);
  });

  it('refuse plus de 4 cartes, un doublon, un talent invalide ou un nom vide', () => {
    assert.throws(() => Deck.create(content([1, 2, 3, 4, 5].map((n) => ({ cardId: `c${n}`, talentSlot: 1 }))), NOW), DomainError);
    assert.throws(() => Deck.create(content([{ cardId: 'c1', talentSlot: 1 }, { cardId: 'c1', talentSlot: 2 }]), NOW), /qu’une fois/);
    assert.throws(() => Deck.create(content([{ cardId: 'c1', talentSlot: 0 }]), NOW), DomainError);
    assert.throws(() => Deck.create({ ...content([]), name: '  ' }, NOW), /nom/);
  });

  it('accepte un DPS parmi ses cartes, et le refuse sinon', () => {
    const slots = [{ cardId: 'c1', talentSlot: 1 }];
    assert.equal(Deck.create({ ...content(slots), dpsCardId: 'c1' }, NOW).dpsCardId, 'c1');
    assert.equal(Deck.create(content(slots), NOW).dpsCardId, null);
    assert.throws(() => Deck.create({ ...content(slots), dpsCardId: 'c9' }, NOW), /DPS/);
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
  resistances: {}, allyResistances: {}, abilities: [], passiveBonusPerTurn: {}, bonusPerHit: {}, startingBonus: {},
  startingBoosts: [], boostsPerTurn: [], unquantified: [],
};

const line = (value: number, element = 'fire', targets = 1, singleTarget = 1) => ({
  value, elements: { [element]: 1 }, targets, singleTarget, weight: 1,
});

const ability = (overrides: Partial<AbilityModel>): AbilityModel => ({
  name: 'Capacité', cooldown: 1, echoChance: 0, period: 1, precision: 100, critChance: 0, critMultiplier: 2, damage: [], heal: [], bonus: [], cost: {},
  growth: { damage: 0, heal: 0, bonus: 0 }, boosts: [], ...overrides,
});

const cardStats = (
  cardId: string,
  base: Partial<StatContribution>,
  talent: Partial<StatContribution> = {},
  bonusFactor = 1,
): DeckCardStats => ({
  cardId, cardName: cardId, talentName: `${cardId}-talent`, base: { ...empty, ...base }, talent: { ...empty, ...talent }, bonusFactor,
});

const damageByTurn = (cards: DeckCardStats[], turns: number, dpsCardId?: string) =>
  analyzeDeck(cards, { turns, dpsCardId }).turns.map((turn) => turn.totalDamage);

describe('analyzeDeck : résistances', () => {
  it('moyenne les résistances, talents et bonus d’équipe compris, et désigne les faiblesses', () => {
    const analysis = analyzeDeck([
      cardStats('a', { resistances: { fire: 10, water: 0 } }, { resistances: { water: 20 } }),
      cardStats('b', { resistances: { fire: 30, water: -10 } }, { allyResistances: { fire: 10, water: 10 } }),
    ]);
    // a : feu 10 + 10, eau 20 + 10 ; b : feu 30 + 10, eau -10 + 10
    assert.deepEqual(analysis.averageResistances, { fire: 30, water: 15 });
    assert.deepEqual(analysis.weaknesses, ['water']);
  });
});

describe('analyzeDeck : simulation', () => {
  it('applique précision, critique (multiplicateur) et recharge', () => {
    const cards = [
      cardStats('a', { abilities: [ability({ damage: [line(10)], precision: 50, critChance: 50, critMultiplier: 3 })] }),
      cardStats('b', { abilities: [ability({ damage: [line(20, 'water')], cooldown: 2 })] }),
    ];
    // a : 10 × 0,5 × (1 + 0,5 × 2) = 10 par tour ; b : 20 au tour 2 seulement, soit 10 par tour sur 2 tours
    const analysis = analyzeDeck(cards, { turns: 2 });
    assert.deepEqual(analysis.damagePerTurn, { fire: 10, water: 10 });
    assert.equal(analysis.totalDamagePerTurn, 20);
  });

  it('suit la recharge : prête au tour N, puis tous les N tours', () => {
    const cards = [
      cardStats('a', { abilities: [ability({ damage: [line(30)], cooldown: 3 })] }),
      cardStats('b', { abilities: [ability({ heal: [line(70, 'light')], cooldown: 5 })] }),
    ];
    const analysis = analyzeDeck(cards, { turns: 7 });
    assert.deepEqual(analysis.turns.map((turn) => turn.totalDamage), [0, 0, 30, 0, 0, 30, 0]);
    assert.deepEqual(analysis.turns.map((turn) => turn.totalHeal), [0, 0, 0, 0, 70, 0, 0]);
  });

  it('suit l’Écho en probabilité : prête au tour suivant avec sa chance', () => {
    const cards = [cardStats('a', { abilities: [ability({ damage: [line(10)], cooldown: 3, echoChance: 0.5 })] })];
    // Probabilité d'être prête : tour 3 : 1 ; tour 4 : 0,5 (Écho) ; tour 5 : 0,25 ;
    // tour 6 : 0,5 (tour 3 sans Écho) + 0,125 (Écho aux tours 4 et 5) = 0,625 ;
    // tour 7 : 0,25 (tour 4 sans Écho) + 0,3125 (Écho au tour 6) = 0,5625.
    assert.deepEqual(damageByTurn(cards, 7), [0, 0, 10, 5, 2.5, 6.25, 5.63]);
  });

  it('distingue dégâts totaux et cible unique : zone, cibles au hasard', () => {
    const cards = [
      // Zone : 10 sur chacune des 4 cartes adverses.
      cardStats('zone', { abilities: [ability({ damage: [line(10, 'fire', 4, 1)] })] }),
      // 2 coups de 8 au hasard parmi 4 adverses : une carte donnée reçoit chaque coup avec 1 chance sur 4.
      cardStats('random', { abilities: [ability({ damage: [line(8, 'water', 1, 0.25), line(8, 'water', 1, 0.25)] })] }),
    ];
    const analysis = analyzeDeck(cards, { turns: 1 });
    assert.deepEqual(analysis.damagePerTurn, { fire: 40, water: 16 });
    assert.deepEqual(analysis.singleTargetDamagePerTurn, { fire: 10, water: 4 });
    assert.equal(analysis.turns[0]?.totalSingleTargetDamage, 14);
    assert.deepEqual(
      analysis.cards.map((card) => [card.damagePerTurn, card.singleTargetDamagePerTurn]),
      [
        [40, 10],
        [16, 4],
      ],
    );
  });

  it('compte un bonus généré dès le tour où il est généré : +10 % par point', () => {
    const cards = [cardStats('a', { abilities: [ability({ damage: [line(10)], bonus: [line(2)] })] })];
    const analysis = analyzeDeck(cards, { turns: 3 });
    assert.deepEqual(analysis.turns.map((turn) => turn.bonusStock['fire']), [2, 4, 6]);
    assert.deepEqual(analysis.turns.map((turn) => turn.totalDamage), [12, 14, 16]);
  });

  it('fait grandir un bonus à chaque utilisation : +1, +2, +3…', () => {
    const cards = [cardStats('a', { abilities: [ability({ bonus: [line(1, 'shadow')], growth: { damage: 0, heal: 0, bonus: 1 } })] })];
    assert.deepEqual(analyzeDeck(cards, { turns: 3 }).turns.map((turn) => turn.bonusStock['shadow']), [1, 3, 6]);
  });

  it('fait grandir les dégâts d’une capacité après chaque utilisation', () => {
    const cards = [cardStats('a', { abilities: [ability({ damage: [line(15, 'earth')], growth: { damage: 5, heal: 0, bonus: 0 } })] })];
    assert.deepEqual(damageByTurn(cards, 3), [15, 20, 25]);
  });

  it('cumule les renforts du lanceur dès le tour où ils sont lancés', () => {
    const critBoost: Boost = { stat: 'critChance', amount: 10, target: 'self', chance: 1 };
    const cards = [cardStats('a', { abilities: [ability({ damage: [line(10)], boosts: [critBoost] })] })];
    // critique 10 %, puis 20 % : 10 × 1,1 ; 10 × 1,2
    assert.deepEqual(damageByTurn(cards, 2), [11, 12]);
  });

  it('applique les renforts ciblés au DPS choisi, et les signale sans DPS', () => {
    const precision: Boost = { stat: 'precision', amount: 50, target: 'dps', chance: 1 };
    const critRatio: Boost = { stat: 'critMultiplier', amount: 1, target: 'dps', chance: 1 };
    const cards = [
      cardStats('support', { abilities: [ability({ name: 'Visée', boosts: [precision, critRatio] })] }),
      cardStats('dps', { abilities: [ability({ damage: [line(10)], precision: 50, critChance: 50 })] }),
    ];
    // Avec DPS : précision 100 %, critique ×3 -> 10 × 1 × (1 + 0,5 × 2) = 20 ; sans : 10 × 0,5 × 1,5 = 7,5
    assert.deepEqual(damageByTurn(cards, 1, 'dps'), [20]);
    const withoutDps = analyzeDeck(cards, { turns: 1 });
    assert.equal(withoutDps.totalDamagePerTurn, 7.5);
    assert.deepEqual(withoutDps.unquantified.map((note) => `${note.cardName} · ${note.source}`), ['support · Visée']);
    assert.equal(analyzeDeck(cards, { turns: 1, dpsCardId: 'dps' }).cards[1]?.finalBoosts.precision, 50);
  });

  it('répartit un renfort « carte alliée au hasard » sur toutes les cartes', () => {
    const boost: Boost = { stat: 'baseDamage', amount: 8, target: 'randomAlly', chance: 1 };
    const cards = [
      cardStats('a', { abilities: [ability({ boosts: [boost] })] }),
      cardStats('b', { abilities: [ability({ damage: [line(10)] })] }),
    ];
    // +8 / 2 cartes = +4 de dégâts de base pour b
    assert.deepEqual(damageByTurn(cards, 1), [14]);
  });

  it('retire les coûts du stock, sans descendre sous zéro', () => {
    const cards = [
      cardStats('a', { abilities: [ability({ bonus: [line(1)], cost: { fire: 3 } })] }, { startingBonus: { fire: 3 } }),
    ];
    assert.deepEqual(analyzeDeck(cards, { turns: 3 }).turns.map((turn) => turn.bonusStock['fire'] ?? 0), [1, 0, 0]);
  });

  it('double l’effet des bonus pour une carte avec Multiplicateur', () => {
    const cards = [
      cardStats('a', { abilities: [ability({ damage: [line(10)] })] }, { startingBonus: { fire: 5 } }, 2),
      cardStats('b', { abilities: [ability({ damage: [line(10)] })] }),
    ];
    assert.deepEqual(damageByTurn(cards, 1), [10 * 2 + 10 * 1.5]);
  });

  it('donne une fourchette pour le Sac de frappe : jamais frappé / frappé à chaque tour', () => {
    const cards = [cardStats('bag', { abilities: [ability({ damage: [line(10, 'nature')] })], bonusPerHit: { nature: 1 } })];
    const analysis = analyzeDeck(cards, { turns: 3 });
    assert.deepEqual(analysis.turns.map((turn) => turn.totalDamage), [10, 10, 10]);
    // Toujours frappée : +1 nature par tour, compté dès le tour -> +10 %, +20 %, +30 %.
    assert.deepEqual(analysis.whenAlwaysHit?.turns.map((turn) => turn.totalDamage), [11, 12, 13]);
    assert.equal(analysis.whenAlwaysHit?.totalDamagePerTurn, 12);
    assert.equal(analyzeDeck([cardStats('a', { abilities: [ability({ damage: [line(10)] })] })]).whenAlwaysHit, null);
  });

  it('applique les renforts de talent au départ et à chaque tour', () => {
    const cards = [
      cardStats(
        'a',
        { abilities: [ability({ damage: [line(10)] })] },
        {
          startingBoosts: [{ stat: 'critChance', amount: 10, target: 'self', chance: 1 }],
          boostsPerTurn: [{ stat: 'critChance', amount: 10, target: 'allies', chance: 1 }],
        },
      ),
    ];
    // critique 20 %, puis 30 %
    assert.deepEqual(damageByTurn(cards, 2), [12, 13]);
  });
});
