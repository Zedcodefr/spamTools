import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Ability, CardAction, CardData, Talent } from '../Card.js';
import { computeCardStats, ENEMY_CARDS, type StatsContext } from './computeCardStats.js';

const BASE = ['fire', 'water', 'earth', 'nature', 'shadow', 'light'];

const action = (effect: string, kind: string, element: string | null, min = 10, max = min, chain = 0): CardAction => ({
  effect, kind, element, min, max, chain, percent: false,
});

const ability = (actions: CardAction[], overrides: Partial<Ability> = {}): Ability => ({
  id: 'a', name: 'Capacité', effect: '', effectRich: '', cooldown: 1, elements: [], precision: 100, critChance: 0,
  critMultiplier: 2, duration: 0, uses: 0, cooldownResetChance: 0, actions, ...overrides,
});

const talent = (slot: number, overrides: Partial<Talent>): Talent => ({
  slot, id: `t${slot}`, name: `Talent ${slot}`, effect: '', effectRich: '', elements: [], grantsSkill: null, actions: [],
  ...overrides,
});

function card(overrides: Partial<CardData>): CardData {
  return {
    id: 'c', slug: 'c', number: 1, name: 'Carte', element: 'nature', rarity: 'common', spamton: 10, hp: 500,
    resistances: { fire: 10, water: 20 }, abilities: [], skills: [], talents: [],
    artwork: { file: '', small: '', tiny: '', width: 1, height: 1, artist: { name: 'Atto', link: null } },
    lore: { species: '', region: '', era: '', text: '' },
    ...overrides,
  };
}

const context: StatsContext = {
  baseElements: BASE,
  elementIdByName: new Map([['feu', 'fire'], ['ombre', 'shadow'], ['nature', 'nature']]),
  grantedPassive: (granted) =>
    granted.grantsSkill === 'CoeurFeu_C'
      ? { key: 'cœur de feu', label: 'Cœur de feu', description: 'Bonus Feu (+1) par tour de jeu' }
      : granted.grantsSkill === 'PunchingBag_C'
        ? { key: 'sac de frappe', label: 'Sac de frappe', description: null }
        : undefined,
  passiveElement: (key) => (key === 'cœur de feu' ? 'fire' : undefined),
  keyOf: (label) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
};

const stats = (overrides: Partial<CardData>) => computeCardStats(card(overrides), context);

describe('computeCardStats', () => {
  it('reprend les résistances de base', () => {
    assert.deepEqual(stats({}).base.resistances, { fire: 10, water: 20 });
  });

  it('rapporte dégâts et bonus à la recharge : recharge N = une utilisation tous les N tours', () => {
    const base = stats({
      abilities: [
        ability([action('damage', 'damage', 'fire', 10, 20), action('AddAllPlayerAttack', 'other', 'water', 2)]),
        ability([action('damage', 'damage', 'fire', 30)], { cooldown: 3 }),
      ],
    }).base;
    assert.deepEqual(base.damagePerTurn, { fire: 15 + 10 });
    assert.deepEqual(base.generatedPerTurn, { water: 2 });
  });

  it('tient compte de la précision, du critique, de la zone et de l’Écho', () => {
    const base = stats({
      abilities: [
        ability([action('damage', 'damage', 'fire', 100)], { precision: 50, critChance: 50, critMultiplier: 3 }),
        ability([action('DamageAll', 'damage', 'shadow', 10)], { cooldown: 2 }),
        // Écho 50 % : disponible au tour suivant une fois sur deux -> période moyenne 0,5 × 1 + 0,5 × 3 = 2.
        ability([action('damage', 'damage', 'light', 20)], { cooldown: 3, cooldownResetChance: 50 }),
      ],
    }).base;
    assert.deepEqual(base.damagePerTurn, { fire: 100 * 0.5 * 2, shadow: (10 * ENEMY_CARDS) / 2, light: 10 });
  });

  it("moyenne les options d'un Choix et répartit un élément aléatoire", () => {
    const base = stats({
      abilities: [
        ability(
          [action('_NULL', 'other', null, 0, 0, 0), action('damage', 'damage', 'fire', 30, 30, 1), action('damage', 'damage', 'water', 10, 10, 2)],
          { effectRich: '{kw:choice}Choix{/kw}' },
        ),
        ability([action('AddAllPlayerAttackRandomTeam', 'other', null, 6)], { effect: 'Bonus (+6) dans un élément aléatoire' }),
      ],
    }).base;
    assert.deepEqual(base.damagePerTurn, { fire: 15, water: 5 });
    assert.deepEqual(base.generatedPerTurn, Object.fromEntries(BASE.map((element) => [element, 1])));
  });

  it('compte les soins par élément, avec précision et critique', () => {
    const base = stats({
      abilities: [ability([action('healTarget', 'heal', 'light', 20)], { cooldown: 2, critChance: 50, critMultiplier: 3 })],
    }).base;
    assert.deepEqual(base.healPerTurn, { light: (20 * 2) / 2 });
  });

  it('compte les coûts en éléments et signale les autres', () => {
    const base = stats({
      abilities: [
        ability([], { cooldown: 2, effect: '[Coût 2 Feu & 4 Ombre]\nAttaque' }),
        ability([], { name: 'Sacrifice', effect: '[Coût 100 PV]' }),
      ],
    }).base;
    assert.deepEqual(base.consumedPerTurn, { fire: 1, shadow: 2 });
    assert.deepEqual(base.unquantified.map((note) => note.source), ['Sacrifice']);
  });

  it('écarte les usages limités et les effets en pourcentage', () => {
    const base = stats({
      abilities: [
        ability([action('damage', 'damage', 'nature', 90)], { name: 'Valse', uses: 1 }),
        ability([{ ...action('DamageOpponentHPMAX', 'damage', 'fire', 30), percent: true }], { name: 'Ratio' }),
      ],
    }).base;
    assert.deepEqual(base.damagePerTurn, {});
    assert.deepEqual(base.unquantified.map((note) => note.source), ['Valse', 'Ratio']);
  });

  it('compte les Cœurs portés en tox, et signale le Sac de frappe', () => {
    const base = stats({
      skills: [
        { id: 'CoeurFeu_R', name: 'Cœur de feu', effect: '', effectRich: '', rarity: 'rare', element: 'fire', value: 2, icon: null },
        { id: 'PunchingBag_C', name: 'Sac de frappe', effect: '', effectRich: '', rarity: 'common', element: null, value: 1, icon: null },
      ],
    }).base;
    assert.deepEqual(base.generatedPerTurn, { fire: 2 });
    assert.deepEqual(base.unquantified.map((note) => note.source), ['Sac de frappe']);
  });

  it('double les bonus élémentaires avec le tox Multiplicateur', () => {
    const multiplier = {
      id: 'Multiplicator_R', name: 'Multiplicateur', effect: '', effectRich: '', rarity: 'rare', element: null, value: 0,
      icon: null,
    };
    assert.equal(stats({ skills: [multiplier] }).bonusFactor, 2);
    assert.equal(stats({}).bonusFactor, 1);
  });

  it("calcule l'apport de chaque talent", () => {
    const { talents } = stats({
      talents: [
        talent(1, { grantsSkill: 'CoeurFeu_C' }),
        talent(2, {
          effect: 'Résistance feu (+25 %) / Résistance eau (+25 %)',
          actions: [action('AddCardResistance', 'other', 'fire', 25), action('AddCardResistance', 'other', 'water', 25)],
        }),
        talent(3, {
          effect: 'Augmente les résistances élémentaires de toutes les cartes alliées de (+10 %)',
          actions: [action('AddOppCardResistance', 'other', 'fire', 10)],
        }),
        talent(4, { effect: 'Bonus (+7) Eau.', actions: [action('AddAllPlayerAttack', 'other', 'water', 7)] }),
        talent(5, {
          name: 'Résilience',
          effect: 'Tant que les PV de cette carte sont sous 50 %, ses résistances augmentent de (+25 %).',
          actions: [action('AddCardResistance', 'other', 'fire', 25)],
        }),
        talent(6, {
          effect: 'Diminue les résistances élémentaires de toutes les cartes adverses de (-1 %)',
          actions: [action('AddOppCardResistance', 'other', 'fire', -1)],
        }),
      ],
    });
    assert.deepEqual(talents['1']?.generatedPerTurn, { fire: 1 });
    assert.deepEqual(talents['2']?.resistances, { fire: 25, water: 25 });
    assert.deepEqual(talents['3']?.allyResistances, { fire: 10 });
    assert.deepEqual(talents['4']?.startingBonus, { water: 7 });
    assert.deepEqual(talents['5']?.resistances, {});
    assert.deepEqual(talents['5']?.unquantified.map((note) => note.source), ['Résilience']);
    assert.deepEqual(talents['6']?.allyResistances, {});
  });
});
